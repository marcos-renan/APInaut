import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";

const BASE_PORT = 3210;
const MAX_PORT_TRIES = 30;
const WEB_WAIT_TIMEOUT_MS = 120_000;

let webProcess = null;
let electronProcess = null;
let shuttingDown = false;

const sanitizedEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => key && !key.includes("=")),
);

const spawnShell = (command, env) =>
  spawn(command, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: true,
    env,
  });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const escapeForPowerShellSingleQuote = (value) => value.replaceAll("'", "''");

const normalizePath = (value) => value.replaceAll("\\", "/").toLowerCase();

const isNextDevCommandLine = (commandLine) => {
  if (!commandLine) {
    return false;
  }

  const normalizedCommand = normalizePath(commandLine);
  const normalizedRoot = normalizePath(projectRoot);
  return (
    normalizedCommand.includes(normalizedRoot) &&
    normalizedCommand.includes("node_modules/next/dist/server/lib/start-server.js")
  );
};

const getExistingNextDevPidsWindows = () => {
  const escapedRootLike = escapeForPowerShellSingleQuote(projectRoot);
  const command = `
$rootLike = '${escapedRootLike}'
$nextMarker = 'node_modules\\next\\dist\\server\\lib\\start-server.js'
$processes = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
  $_.CommandLine -and $_.CommandLine -like "*$rootLike*" -and $_.CommandLine -like "*$nextMarker*"
}
$processes | Select-Object -ExpandProperty ProcessId | ConvertTo-Json -Compress
`;

  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", command], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    cwd: projectRoot,
    windowsHide: true,
  });

  if (result.error) {
    return [];
  }

  let parsed = null;
  try {
    parsed = result.stdout?.trim() ? JSON.parse(result.stdout.trim()) : [];
  } catch {
    parsed = [];
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];
  return items
    .map((value) => Number(value))
    .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
};

const getExistingNextDevPidsPosix = () => {
  const result = spawnSync("ps", ["-ax", "-o", "pid=,command="], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    cwd: projectRoot,
  });

  if (result.error || result.status !== 0) {
    return [];
  }

  const lines = result.stdout.split(/\r?\n/).map((line) => line.trim());
  const pids = [];

  for (const line of lines) {
    if (!line) {
      continue;
    }

    const firstSpace = line.indexOf(" ");
    if (firstSpace <= 0) {
      continue;
    }

    const pidText = line.slice(0, firstSpace).trim();
    const commandLine = line.slice(firstSpace + 1).trim();
    const pid = Number(pidText);

    if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) {
      continue;
    }

    if (isNextDevCommandLine(commandLine)) {
      pids.push(pid);
    }
  }

  return pids;
};

const getExistingNextDevPids = () => {
  if (isWindows) {
    return getExistingNextDevPidsWindows();
  }

  return getExistingNextDevPidsPosix();
};

const canListenOnHost = (port, host) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (error) => {
      if (error && (error.code === "EAFNOSUPPORT" || error.code === "EADDRNOTAVAIL")) {
        resolve(true);
        return;
      }

      resolve(false);
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });

const isPortFree = async (port) => {
  const ipv6Free = await canListenOnHost(port, "::");
  if (!ipv6Free) {
    return false;
  }

  const ipv4Free = await canListenOnHost(port, "127.0.0.1");
  return ipv4Free;
};

const findFreePort = async (startPort) => {
  for (let port = startPort; port < startPort + MAX_PORT_TRIES; port += 1) {
    const free = await isPortFree(port);
    if (free) {
      return port;
    }
  }

  throw new Error(
    `Nao foi possivel encontrar porta livre no intervalo ${startPort}-${startPort + MAX_PORT_TRIES - 1}.`,
  );
};

const waitForHttpReady = async (urls, timeoutMs) => {
  const startedAt = Date.now();
  const targets = Array.isArray(urls) ? urls : [urls];

  while (Date.now() - startedAt < timeoutMs) {
    for (const target of targets) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);

      try {
        const response = await fetch(target, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.status >= 200 && response.status < 600) {
          return target;
        }
      } catch {
        clearTimeout(timeout);
      }
    }

    await delay(250);
  }

  throw new Error(`Timeout aguardando resposta HTTP em ${targets.join(", ")}.`);
};

const killProcessByPid = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) {
    return;
  }

  if (isWindows) {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      cwd: projectRoot,
      windowsHide: true,
      stdio: "ignore",
    });
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // Ignore if already gone.
  }
};

const killChild = (child) => {
  if (!child || child.killed) {
    return;
  }

  try {
    child.kill("SIGTERM");
  } catch {
    // Ignore shutdown errors.
  }
};

const shutdown = (code = 0) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  killChild(electronProcess);
  killChild(webProcess);
  setTimeout(() => process.exit(code), 50);
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const run = async () => {
  const staleNextPids = [...new Set(getExistingNextDevPids())];
  for (const pid of staleNextPids) {
    console.log(`[apinaut] Encerrando next dev antigo (PID ${pid})`);
    killProcessByPid(pid);
  }

  if (staleNextPids.length > 0) {
    await delay(700);
  }

  const port = await findFreePort(BASE_PORT);
  const startUrl = `http://localhost:${port}`;
  const probeUrls = [`http://localhost:${port}`, `http://127.0.0.1:${port}`, `http://[::1]:${port}`];

  console.log(`[apinaut] Iniciando web em ${startUrl}`);

  webProcess = spawnShell(`npm run dev:web -- --port ${port}`, sanitizedEnv);
  webProcess.on("exit", (code) => {
    if (shuttingDown) {
      return;
    }

    shutdown(code ?? 1);
  });

  await waitForHttpReady(probeUrls, WEB_WAIT_TIMEOUT_MS);

  console.log(`[apinaut] Abrindo Electron em ${startUrl}`);

  electronProcess = spawnShell("npm run dev:electron", {
    ...sanitizedEnv,
    ELECTRON_START_URL: startUrl,
  });
  electronProcess.on("exit", (code) => {
    if (shuttingDown) {
      return;
    }

    shutdown(code ?? 0);
  });
};

run().catch((error) => {
  console.error(`[apinaut] Erro ao iniciar ambiente dev: ${error.message}`);
  shutdown(1);
});

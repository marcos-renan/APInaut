import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain } from "electron";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const DEFAULT_WINDOW_ICON_PATH = path.join(__dirname, "..", "public", "apinaut.ico");
const LINUX_WINDOW_ICON_PATH = path.join(__dirname, "..", "build", "icons", "icon.png");
const LEGACY_WINDOW_ICON_PATH = path.join(__dirname, "..", "public", "apinaut-logo.png");
const WINDOWS_WINDOW_ICON_PATH = path.join(__dirname, "..", "build", "icons", "icon.ico");
const DEFAULT_START_URL = "http://localhost:3210";
const STANDALONE_SERVER_RELATIVE_PATH = "server.js";
const LOAD_RETRY_ATTEMPTS = 40;
const LOAD_RETRY_DELAY_MS = 250;
const EMBEDDED_SERVER_BASE_PORT = 3210;
const EMBEDDED_SERVER_MAX_PORT_TRIES = 30;
const EMBEDDED_SERVER_READY_TIMEOUT_MS = 120_000;
const SHOULD_SILENCE_RUNTIME_LOGS = process.env.APINAUT_SILENT !== "0";
const SHOULD_DETACH_FROM_TERMINAL = process.env.APINAUT_DETACH !== "0";
const SILENCED_LOG_PATTERNS = [
  "MESA: error: ZINK: failed to choose pdev",
  "glx: failed to create drisw screen",
  "▲ Next.js",
  "- Local:",
  "- Network:",
  "✓ Ready in",
  "[apinaut] Servidor interno iniciado em",
];

let mainWindow = null;
let embeddedWebServerUrl = null;

const maybeDetachFromTerminal = () => {
  const launchedFromTerminal = Boolean(process.stdout?.isTTY || process.stdin?.isTTY);
  const alreadyDetachedChild = process.env.APINAUT_DETACHED_CHILD === "1";

  if (
    process.platform !== "linux" ||
    !app.isPackaged ||
    !SHOULD_DETACH_FROM_TERMINAL ||
    !launchedFromTerminal ||
    alreadyDetachedChild
  ) {
    return;
  }

  try {
    const detachedChild = spawn(process.execPath, process.argv.slice(1), {
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        APINAUT_DETACHED_CHILD: "1",
      },
    });
    detachedChild.unref();
    process.exit(0);
  } catch (error) {
    console.error("[apinaut] Falha ao destacar processo no Linux.", error);
  }
};

maybeDetachFromTerminal();

if (process.platform === "linux") {
  // Reduz ruidos de driver OpenGL em ambientes Linux/WSL.
  app.disableHardwareAcceleration();

  if (SHOULD_SILENCE_RUNTIME_LOGS) {
    // Diminui verbosidade de drivers OpenGL no Linux.
    process.env.LIBGL_DEBUG = process.env.LIBGL_DEBUG ?? "quiet";
    process.env.MESA_LOG_LEVEL = process.env.MESA_LOG_LEVEL ?? "0";
  }
}

const silenceRuntimeLogsIfNeeded = () => {
  if (!app.isPackaged || !SHOULD_SILENCE_RUNTIME_LOGS) {
    return;
  }

  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};

  const shouldSilenceChunk = (chunk) => {
    const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    return SILENCED_LOG_PATTERNS.some((pattern) => text.includes(pattern));
  };

  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, ...args) => {
    if (shouldSilenceChunk(chunk)) {
      return true;
    }

    return originalStdoutWrite(chunk, ...args);
  };

  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...args) => {
    if (shouldSilenceChunk(chunk)) {
      return true;
    }

    return originalStderrWrite(chunk, ...args);
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveWindowIconPath = () => {
  if (process.platform === "linux") {
    if (fs.existsSync(LINUX_WINDOW_ICON_PATH)) {
      return LINUX_WINDOW_ICON_PATH;
    }

    if (fs.existsSync(LEGACY_WINDOW_ICON_PATH)) {
      return LEGACY_WINDOW_ICON_PATH;
    }

    return undefined;
  }

  if (process.platform === "win32" && fs.existsSync(WINDOWS_WINDOW_ICON_PATH)) {
    return WINDOWS_WINDOW_ICON_PATH;
  }

  if (fs.existsSync(DEFAULT_WINDOW_ICON_PATH)) {
    return DEFAULT_WINDOW_ICON_PATH;
  }

  if (fs.existsSync(LEGACY_WINDOW_ICON_PATH)) {
    return LEGACY_WINDOW_ICON_PATH;
  }

  return undefined;
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

const findFreePort = async (startPort) => {
  for (let port = startPort; port < startPort + EMBEDDED_SERVER_MAX_PORT_TRIES; port += 1) {
    const ipv6Free = await canListenOnHost(port, "::");
    if (!ipv6Free) {
      continue;
    }

    const ipv4Free = await canListenOnHost(port, "127.0.0.1");
    if (ipv4Free) {
      return port;
    }
  }

  throw new Error(
    `Nao foi possivel encontrar porta livre no intervalo ${startPort}-${startPort + EMBEDDED_SERVER_MAX_PORT_TRIES - 1}.`,
  );
};

const waitForHttpReady = async (urls, timeoutMs) => {
  const targets = Array.isArray(urls) ? urls : [urls];
  const startedAt = Date.now();

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

    await sleep(250);
  }

  throw new Error(`Timeout aguardando resposta HTTP em ${targets.join(", ")}.`);
};

const resolveStandaloneServerCandidates = () => {
  const candidates = [];

  if (app.isPackaged) {
    candidates.push(path.join(process.resourcesPath, "app.asar", STANDALONE_SERVER_RELATIVE_PATH));
    candidates.push(path.join(process.resourcesPath, "app", STANDALONE_SERVER_RELATIVE_PATH));
    candidates.push(path.join(process.resourcesPath, "app.asar.unpacked", STANDALONE_SERVER_RELATIVE_PATH));
  }

  candidates.push(path.join(__dirname, "..", ".next", "standalone", STANDALONE_SERVER_RELATIVE_PATH));
  candidates.push(path.join(__dirname, "..", STANDALONE_SERVER_RELATIVE_PATH));

  const uniqueCandidates = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const normalized = path.normalize(candidate);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueCandidates.push(normalized);
    }
  }

  return uniqueCandidates;
};

const requireStandaloneServer = (serverCandidates) => {
  const errors = [];

  for (const candidatePath of serverCandidates) {
    try {
      require(candidatePath);
      return candidatePath;
    } catch (error) {
      errors.push({
        path: candidatePath,
        message: error?.message ?? String(error),
      });
    }
  }

  const details = errors.map((entry) => `${entry.path} -> ${entry.message}`).join(" | ");
  throw new Error(`server.js standalone nao encontrado/carregavel. Tentativas: ${details}`);
};

const startEmbeddedNextServer = async () => {
  if (embeddedWebServerUrl) {
    return embeddedWebServerUrl;
  }

  const serverCandidates = resolveStandaloneServerCandidates();

  const port = await findFreePort(EMBEDDED_SERVER_BASE_PORT);
  const startUrl = `http://localhost:${port}`;
  const probeUrls = [startUrl, `http://127.0.0.1:${port}`, `http://[::1]:${port}`];

  const previousPort = process.env.PORT;
  const previousHostname = process.env.HOSTNAME;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDisableNextCache = process.env.APINAUT_DISABLE_NEXT_CACHE;

  process.env.PORT = String(port);
  process.env.HOSTNAME = "127.0.0.1";
  process.env.NODE_ENV = "production";
  // Next standalone roda de /opt no Linux instalado (.deb), que e somente leitura.
  // Esse flag evita tentativas de escrita em .next/cache durante o boot do servidor.
  process.env.APINAUT_DISABLE_NEXT_CACHE = "1";

  let loadedServerFrom = null;
  try {
    loadedServerFrom = requireStandaloneServer(serverCandidates);
  } finally {
    if (previousPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = previousPort;
    }

    if (previousHostname === undefined) {
      delete process.env.HOSTNAME;
    } else {
      process.env.HOSTNAME = previousHostname;
    }

    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }

    if (previousDisableNextCache === undefined) {
      delete process.env.APINAUT_DISABLE_NEXT_CACHE;
    } else {
      process.env.APINAUT_DISABLE_NEXT_CACHE = previousDisableNextCache;
    }
  }

  await waitForHttpReady(probeUrls, EMBEDDED_SERVER_READY_TIMEOUT_MS);
  embeddedWebServerUrl = startUrl;
  console.log(
    `[apinaut] Servidor interno iniciado em ${startUrl}${loadedServerFrom ? ` (${loadedServerFrom})` : ""}`,
  );
  return startUrl;
};

const resolveStartUrl = async () => {
  if (process.env.ELECTRON_START_URL) {
    return process.env.ELECTRON_START_URL;
  }

  if (!app.isPackaged) {
    return DEFAULT_START_URL;
  }

  try {
    return await startEmbeddedNextServer();
  } catch (error) {
    console.error("[apinaut] Falha ao iniciar servidor interno.", error);
    return DEFAULT_START_URL;
  }
};

const loadRendererWithRetry = async (window, startUrl) => {
  let lastError = null;

  for (let attempt = 1; attempt <= LOAD_RETRY_ATTEMPTS; attempt += 1) {
    if (window.isDestroyed()) {
      return false;
    }

    try {
      await window.loadURL(startUrl);
      return true;
    } catch (error) {
      lastError = error;
      if (attempt < LOAD_RETRY_ATTEMPTS) {
        await sleep(LOAD_RETRY_DELAY_MS);
      }
    }
  }

  console.error("[apinaut] Falha ao carregar URL inicial.", {
    startUrl,
    lastError: lastError?.message ?? String(lastError),
  });

  return false;
};

const loadFallbackPage = async (window, startUrl) => {
  if (window.isDestroyed()) {
    return;
  }

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>APInaut</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #100e1a;
        color: #f4f2ff;
        font-family: Segoe UI, sans-serif;
      }
      .card {
        max-width: 640px;
        border: 1px solid rgba(255,255,255,.16);
        border-radius: 14px;
        background: rgba(255,255,255,.04);
        padding: 20px;
      }
      .muted { color: #cfc8f6; opacity: .9; }
      code {
        display: inline-block;
        margin-top: 10px;
        color: #d6ccff;
        background: rgba(0,0,0,.22);
        border-radius: 8px;
        padding: 6px 8px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>APInaut</h2>
      <p class="muted">Nao foi possivel conectar no servidor web agora.</p>
      <p class="muted">Tente novamente em alguns segundos.</p>
      <code>${startUrl}</code>
    </div>
  </body>
</html>`;

  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  await window.loadURL(dataUrl);
};

const createMainWindow = async () => {
  const isWindows = process.platform === "win32";

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 520,
    minHeight: 420,
    show: false,
    frame: isWindows ? true : false,
    titleBarStyle: isWindows ? "hidden" : "default",
    titleBarOverlay:
      isWindows
        ? {
            color: "#151225",
            symbolColor: "#f5f3ff",
            height: 44,
          }
        : false,
    title: "APInaut",
    icon: resolveWindowIconPath(),
    backgroundColor: "#09090b",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const startUrl = await resolveStartUrl();

  const sendMaximizedState = () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.webContents.send("window:maximized", mainWindow.isMaximized());
  };

  mainWindow.on("maximize", sendMaximizedState);
  mainWindow.on("unmaximize", sendMaximizedState);
  mainWindow.on("enter-full-screen", sendMaximizedState);
  mainWindow.on("leave-full-screen", sendMaximizedState);
  mainWindow.once("ready-to-show", () => {
    sendMaximizedState();
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  });
  mainWindow.webContents.on(
    "did-fail-load",
    (_, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) {
        return;
      }

      console.error("[apinaut] did-fail-load", {
        errorCode,
        errorDescription,
        validatedURL,
      });
    },
  );
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const loaded = await loadRendererWithRetry(mainWindow, startUrl);

  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (!loaded) {
    await loadFallbackPage(mainWindow, startUrl);
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
};

app.whenReady().then(async () => {
  silenceRuntimeLogsIfNeeded();
  app.setName("APInaut");
  app.setAppUserModelId("com.apinaut.desktop");
  if (process.platform === "linux") {
    app.setDesktopName("apinaut.desktop");
  }

  ipcMain.on("window:minimize", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.minimize();
  });

  ipcMain.on("window:toggle-maximize", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return;
    }

    mainWindow.maximize();
  });

  ipcMain.on("window:close", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.close();
  });

  ipcMain.handle("window:is-maximized", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return false;
    }

    return mainWindow.isMaximized();
  });

  await createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow().catch((error) => {
        console.error("[apinaut] Falha ao recriar janela.", error);
      });
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

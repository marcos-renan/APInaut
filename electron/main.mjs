import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain } from "electron";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const DEFAULT_WINDOW_ICON_PATH = path.join(__dirname, "..", "public", "apinaut-logo.png");
const WINDOWS_WINDOW_ICON_PATH = path.join(__dirname, "..", "build", "icons", "icon.ico");
const DEFAULT_START_URL = "http://localhost:3210";
const STANDALONE_SERVER_RELATIVE_PATH = "server.js";
const LOAD_RETRY_ATTEMPTS = 40;
const LOAD_RETRY_DELAY_MS = 250;
const EMBEDDED_SERVER_BASE_PORT = 3210;
const EMBEDDED_SERVER_MAX_PORT_TRIES = 30;
const EMBEDDED_SERVER_READY_TIMEOUT_MS = 120_000;

let mainWindow = null;
let embeddedWebServerUrl = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveWindowIconPath = () => {
  if (process.platform === "win32" && fs.existsSync(WINDOWS_WINDOW_ICON_PATH)) {
    return WINDOWS_WINDOW_ICON_PATH;
  }

  if (fs.existsSync(DEFAULT_WINDOW_ICON_PATH)) {
    return DEFAULT_WINDOW_ICON_PATH;
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

const resolveStandaloneServerPath = () => {
  const packagedUnpackedPath = path.join(process.resourcesPath, "app", STANDALONE_SERVER_RELATIVE_PATH);
  if (fs.existsSync(packagedUnpackedPath)) {
    return packagedUnpackedPath;
  }

  const packagedPath = path.join(process.resourcesPath, "app.asar", STANDALONE_SERVER_RELATIVE_PATH);
  if (fs.existsSync(packagedPath)) {
    return packagedPath;
  }

  const localPath = path.join(__dirname, "..", ".next", "standalone", STANDALONE_SERVER_RELATIVE_PATH);
  if (fs.existsSync(localPath)) {
    return localPath;
  }

  return null;
};

const startEmbeddedNextServer = async () => {
  if (embeddedWebServerUrl) {
    return embeddedWebServerUrl;
  }

  const serverScriptPath = resolveStandaloneServerPath();
  if (!serverScriptPath) {
    throw new Error("server.js standalone nao encontrado no pacote.");
  }

  const port = await findFreePort(EMBEDDED_SERVER_BASE_PORT);
  const startUrl = `http://localhost:${port}`;
  const probeUrls = [startUrl, `http://127.0.0.1:${port}`, `http://[::1]:${port}`];

  const previousPort = process.env.PORT;
  const previousHostname = process.env.HOSTNAME;
  const previousNodeEnv = process.env.NODE_ENV;

  process.env.PORT = String(port);
  process.env.HOSTNAME = "127.0.0.1";
  process.env.NODE_ENV = "production";

  try {
    require(serverScriptPath);
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
  }

  await waitForHttpReady(probeUrls, EMBEDDED_SERVER_READY_TIMEOUT_MS);
  embeddedWebServerUrl = startUrl;
  console.log(`[apinaut] Servidor interno iniciado em ${startUrl}`);
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
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 760,
    minHeight: 520,
    show: false,
    frame: false,
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
  app.setName("APInaut");
  app.setAppUserModelId("com.apinaut.desktop");

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

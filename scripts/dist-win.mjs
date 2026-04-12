import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rcedit } from "rcedit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const readAppVersion = async () => {
  const packagePath = path.join(projectRoot, "package.json");
  const raw = await fs.readFile(packagePath, "utf8");
  const parsed = JSON.parse(raw);
  const version = typeof parsed.version === "string" ? parsed.version.trim() : "";

  if (!version) {
    throw new Error("Versao invalida no package.json.");
  }

  return version;
};

const run = (command, args, env = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, ...env },
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} falhou com codigo ${code}.`));
    });
  });

const main = async () => {
  if (process.platform !== "win32") {
    throw new Error("O script dist-win.mjs deve ser executado no Windows.");
  }

  const iconPath = path.join(projectRoot, "build", "icons", "icon.ico");
  const prepackagedPath = path.join(projectRoot, "release", "win-unpacked");
  const exePath = path.join(prepackagedPath, "APInaut.exe");
  const appVersion = await readAppVersion();
  const numericVersion = /^\d+\.\d+\.\d+$/.test(appVersion) ? appVersion : "1.0.0";

  await run("npm", ["run", "build"]);
  await run(
    "npx",
    ["electron-builder", "--projectDir", ".desktop-app", "--win", "dir", "--x64", "--publish", "never"],
    { CSC_IDENTITY_AUTO_DISCOVERY: "false" },
  );

  await rcedit(exePath, {
    icon: iconPath,
    "product-version": numericVersion,
    "file-version": `${numericVersion}.0`,
    "version-string": {
      CompanyName: "Marcos Renan",
      FileDescription: "APInaut",
      ProductName: "APInaut",
      OriginalFilename: "APInaut.exe",
      InternalName: "APInaut",
    },
  });

  await run(
    "npx",
    [
      "electron-builder",
      "--projectDir",
      ".desktop-app",
      "--win",
      "nsis",
      "--x64",
      "--prepackaged",
      prepackagedPath,
      "--publish",
      "never",
    ],
    { CSC_IDENTITY_AUTO_DISCOVERY: "false" },
  );
};

main().catch((error) => {
  console.error(`[apinaut] Falha no dist Windows: ${error.message}`);
  process.exit(1);
});

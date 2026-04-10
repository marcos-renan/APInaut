import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const sourceStandaloneDir = path.join(projectRoot, ".next", "standalone");
const sourceStaticDir = path.join(projectRoot, ".next", "static");
const sourcePublicDir = path.join(projectRoot, "public");
const sourceElectronDir = path.join(projectRoot, "electron");
const sourceBuildDir = path.join(projectRoot, "build");

const stageDir = path.join(projectRoot, ".desktop-app");
const stageStaticDir = path.join(stageDir, ".next", "static");
const stagePublicDir = path.join(stageDir, "public");
const stageElectronDir = path.join(stageDir, "electron");
const stageBuildDir = path.join(stageDir, "build");
const stageNodeModulesDir = path.join(stageDir, "node_modules");

const exists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const copyDir = async (source, destination) => {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(source, destination, { recursive: true, force: true, dereference: true });
};

const readPackageJson = async (packageDir) => {
  const packageJsonPath = path.join(packageDir, "package.json");
  try {
    const raw = await fs.readFile(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.name !== "string" || typeof parsed.version !== "string") {
      return null;
    }
    return { name: parsed.name, version: parsed.version };
  } catch {
    return null;
  }
};

const collectRuntimeDependencies = async (nodeModulesDir) => {
  const dependencies = {};
  const entries = await fs.readdir(nodeModulesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (entry.name === ".bin") {
      continue;
    }

    const entryPath = path.join(nodeModulesDir, entry.name);

    if (entry.name.startsWith("@")) {
      const scopedEntries = await fs.readdir(entryPath, { withFileTypes: true });
      for (const scopedEntry of scopedEntries) {
        if (!scopedEntry.isDirectory()) {
          continue;
        }

        const packageInfo = await readPackageJson(path.join(entryPath, scopedEntry.name));
        if (packageInfo) {
          dependencies[packageInfo.name] = packageInfo.version;
        }
      }
      continue;
    }

    const packageInfo = await readPackageJson(entryPath);
    if (packageInfo) {
      dependencies[packageInfo.name] = packageInfo.version;
    }
  }

  return dependencies;
};

const run = async () => {
  const standaloneExists = await exists(sourceStandaloneDir);
  if (!standaloneExists) {
    throw new Error("Pasta .next/standalone nao encontrada. Rode `npm run build:web` primeiro.");
  }

  const staticExists = await exists(sourceStaticDir);
  if (!staticExists) {
    throw new Error("Pasta .next/static nao encontrada. Rode `npm run build:web` primeiro.");
  }

  await fs.rm(stageDir, { recursive: true, force: true });
  await copyDir(sourceStandaloneDir, stageDir);
  await copyDir(sourceStaticDir, stageStaticDir);
  await copyDir(sourceElectronDir, stageElectronDir);

  const publicExists = await exists(sourcePublicDir);
  if (publicExists) {
    await copyDir(sourcePublicDir, stagePublicDir);
  }

  const buildExists = await exists(sourceBuildDir);
  if (buildExists) {
    await copyDir(sourceBuildDir, stageBuildDir);
  }

  const rootPackagePath = path.join(projectRoot, "package.json");
  const rootPackageRaw = await fs.readFile(rootPackagePath, "utf8");
  const rootPackage = JSON.parse(rootPackageRaw);
  const configuredElectronVersion = String(rootPackage?.devDependencies?.electron ?? "41.2.0").replace(
    /^[^\d]*/,
    "",
  );
  const runtimeDependencies = await collectRuntimeDependencies(stageNodeModulesDir);
  const stagePackage = {
    name: rootPackage.name ?? "apinaut",
    version: rootPackage.version ?? "0.1.0",
    description: rootPackage.description ?? "Cliente API desktop APInaut",
    author:
      typeof rootPackage.author === "object" && rootPackage.author
        ? rootPackage.author
        : {
            name: "Marcos Renan",
            email: "devmarcos7@gmail.com",
          },
    homepage: typeof rootPackage.homepage === "string" ? rootPackage.homepage : "",
    private: true,
    main: "electron/main.mjs",
    dependencies: runtimeDependencies,
    build: {
      appId: "com.apinaut.desktop",
      productName: "APInaut",
      electronVersion: configuredElectronVersion || "41.2.0",
      asar: false,
      npmRebuild: false,
      nodeGypRebuild: false,
      buildDependenciesFromSource: false,
      compression: "maximum",
      electronLanguages: ["pt-BR", "en-US"],
      directories: {
        buildResources: "build",
        output: "../release",
      },
      files: ["**/*"],
      extraMetadata: {
        main: "electron/main.mjs",
      },
      win: {
        signAndEditExecutable: false,
        icon: "build/icons/icon.ico",
        target: [
          {
            target: "nsis",
            arch: ["x64"],
          },
        ],
      },
      nsis: {
        installerIcon: "build/icons/icon.ico",
        uninstallerIcon: "build/icons/icon.ico",
        installerHeaderIcon: "build/icons/icon.ico",
        installerSidebar: "build/installer-sidebar.bmp",
        uninstallerSidebar: "build/installer-sidebar.bmp",
        installerHeader: "build/installer-header.bmp",
      },
      linux: {
        category: "Development",
        maintainer: "Marcos Renan <devmarcos7@gmail.com>",
        icon: "build/icons/icon.png",
        target: [
          {
            target: "AppImage",
            arch: ["x64"],
          },
        ],
      },
    },
  };

  await fs.writeFile(path.join(stageDir, "package.json"), `${JSON.stringify(stagePackage, null, 2)}\n`, "utf8");

  console.log("[apinaut] Runtime desktop preparado em .desktop-app");
};

run().catch((error) => {
  console.error(`[apinaut] Falha ao preparar runtime desktop: ${error.message}`);
  process.exit(1);
});

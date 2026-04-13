import { execSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";

const logPrefix = "[apinaut]";
const require = createRequire(import.meta.url);

const isLinux = process.platform === "linux";

if (!isLinux) {
  console.log(`${logPrefix} Plataforma nao-Linux. Verificacao do lightningcss ignorada.`);
  process.exit(0);
}

const detectMusl = () => {
  try {
    const report = process.report?.getReport?.();
    if (report?.header?.glibcVersionRuntime) {
      return false;
    }
  } catch {
    // segue para fallback
  }

  try {
    const lddVersion = execSync("ldd --version", { encoding: "utf8" }).toLowerCase();
    return lddVersion.includes("musl");
  } catch {
    return false;
  }
};

const resolveExpectedPackage = () => {
  const isMusl = detectMusl();

  if (process.arch === "x64") {
    return isMusl ? "lightningcss-linux-x64-musl" : "lightningcss-linux-x64-gnu";
  }

  if (process.arch === "arm64") {
    return isMusl ? "lightningcss-linux-arm64-musl" : "lightningcss-linux-arm64-gnu";
  }

  if (process.arch === "arm") {
    return "lightningcss-linux-arm-gnueabihf";
  }

  return null;
};

const expectedPackage = resolveExpectedPackage();

if (!expectedPackage) {
  console.log(
    `${logPrefix} Arquitetura ${process.arch} nao mapeada para pacote nativo do lightningcss. Seguindo sem ajuste automatico.`,
  );
  process.exit(0);
}

const hasPackage = (packageName) => {
  try {
    require.resolve(packageName, { paths: [process.cwd()] });
    return true;
  } catch {
    return false;
  }
};

if (hasPackage(expectedPackage)) {
  console.log(`${logPrefix} Pacote nativo encontrado: ${expectedPackage}`);
  process.exit(0);
}

console.log(`${logPrefix} Instalando pacote nativo ausente: ${expectedPackage}`);

const installResult = spawnSync(
  "npm",
  ["install", "--no-save", "--include=optional", expectedPackage],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

if (installResult.status !== 0) {
  process.exit(installResult.status ?? 1);
}

console.log(`${logPrefix} Pacote nativo instalado com sucesso: ${expectedPackage}`);

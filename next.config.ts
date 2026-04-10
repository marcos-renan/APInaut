import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    // Evita escrita de cache de otimizacao de imagem em /opt no app instalado (.deb).
    unoptimized: true,
  },
};

export default nextConfig;

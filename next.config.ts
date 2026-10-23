import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === "true";
// ⚠️ Confirme que este nome é idêntico ao nome do seu repositório no GitHub:
const repoName = "bnb-painel-gerencial";

const nextConfig: NextConfig = {
  output: isGithubPages ? "export" : undefined,
  basePath: isGithubPages ? `/${repoName}` : "",
  assetPrefix: isGithubPages ? `/${repoName}/` : undefined,
  trailingSlash: isGithubPages ? true : false,
  images: {
    unoptimized: isGithubPages ? true : false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
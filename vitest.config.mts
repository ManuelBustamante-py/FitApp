import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const nodeMajor = Number(process.versions.node.split(".")[0]);

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    // Con Node 26 (prerelease) los pools forks/threads no inicializan el runner;
    // vmThreads sí funciona. CI y Vercel usan Node 24 con el pool por defecto.
    pool: nodeMajor >= 26 ? "vmThreads" : "forks",
  },
});

import { defineConfig } from "vite";
import { codecovVitePlugin } from "@codecov/vite-plugin";

export default defineConfig({
  plugins: [
    codecovVitePlugin({
      enableBundleAnalysis: true,
      bundleName: "mcp-archimate",
      uploadToken: process.env.CODECOV_TOKEN,
    }),
  ],
  build: {
    lib: { entry: "src/main.ts", formats: ["es"] }, // Important pour un serveur Node
  }
});
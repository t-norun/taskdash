import { defineConfig } from "vite";
import path from "node:path";
import * as rr from "@react-router/dev/vite";

const reactRouterPlugin =
  // 1) default が関数ならそれを呼ぶ
  typeof (rr as any).default === "function"
    ? (rr as any).default()
    // 2) named export が関数ならそれを呼ぶ（万が一）
    : typeof (rr as any).reactRouter === "function"
      ? (rr as any).reactRouter()
      // 3) それ以外なら “プラグイン本体” をそのまま使う
      : (rr as any).default ?? (rr as any);

export default defineConfig({
  plugins: [reactRouterPlugin],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  esbuild: {
    jsx: "automatic",
  },

  cacheDir: "./.vitest",

  server: {
    fs: {
      allow: [
        path.resolve(__dirname),
        path.resolve(__dirname, "../../../.."),
        path.resolve(__dirname, "../../../../node_modules"),
      ],
    },
  },
});

import path from "node:path";
import { reactRouter } from "@react-router/dev/vite";
import { reactRouterHonoServer } from "react-router-hono-server/dev";
import { defineConfig, loadEnv } from "vite";
import babel from "vite-plugin-babel";
import tsconfigPaths from "vite-tsconfig-paths";
import { addRenderIds } from "./plugins/addRenderIds";
import { aliases } from "./plugins/aliases";
import consoleToParent from "./plugins/console-to-parent";
import { layoutWrapperPlugin } from "./plugins/layouts";
import { loadFontsFromTailwindSource } from "./plugins/loadFontsFromTailwindSource";
import { nextPublicProcessEnv } from "./plugins/nextPublicProcessEnv";
import { restart } from "./plugins/restart";
import { restartEnvFileChange } from "./plugins/restartEnvFileChange";

export default defineConfig(({ mode }) => {
  // .env / .env.local / etc を読む（Vite標準）
  // prefix "" なので VITE_* 以外も env に入る（USE_LOCAL_API みたいなフラグも拾える）
  const env = loadEnv(mode, process.cwd(), "");

  /**
   * ✅ 切替スイッチ
   * - 本番APIで動かす（デフォルト）: USE_LOCAL_API を未設定
   * - ローカルAPIで動かす: USE_LOCAL_API=1
   */
  const useLocalApi = env.USE_LOCAL_API === "1";

  return {
    // ✅ Viteの VITE_* を import.meta.env で使えるようにする
    // （以前 "NEXT_PUBLIC_" だけにしてたのが、VITE_API_BASE_URL を殺してた）
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],

    optimizeDeps: {
      include: ["fast-glob", "lucide-react"],
      exclude: [
        "@hono/auth-js/react",
        "@hono/auth-js",
        "@auth/core",
        "@hono/auth-js",
        "hono/context-storage",
        "@auth/core/errors",
        "fsevents",
        "lightningcss",
      ],
    },

    logLevel: "info",

    plugins: [
      // ✅ tsconfig の paths（@/*）を Vite に反映
      // これが今回の主役。できるだけ早い段階で入れる。
      tsconfigPaths(),

      nextPublicProcessEnv(),
      restartEnvFileChange(),

      reactRouterHonoServer({
        serverEntryPoint: "./__create/index.ts",
        runtime: "node",
      }),

      babel({
        include: ["src/**/*.{js,jsx,ts,tsx}"],
        exclude: /node_modules/,
        babelConfig: {
          babelrc: false,
          configFile: false,
          plugins: ["styled-jsx/babel"],
        },
      }),

      restart({
        restart: [
          "src/**/page.jsx",
          "src/**/page.tsx",
          "src/**/layout.jsx",
          "src/**/layout.tsx",
          "src/**/route.js",
          "src/**/route.ts",
        ],
      }),

      consoleToParent(),
      loadFontsFromTailwindSource(),
      addRenderIds(),
      reactRouter(),

      // 既存の aliases プラグインが何をしているか不明なので最後に寄せる
      // （tsconfigPaths の解決を上書きしないように）
      aliases(),
      layoutWrapperPlugin(),
    ],

    resolve: {
      alias: {
        lodash: "lodash-es",
        "npm:stripe": "stripe",
        stripe: path.resolve(__dirname, "./src/__create/stripe"),
        "@auth/create/react": "@hono/auth-js/react",
        "@auth/create": path.resolve(__dirname, "./src/__create/@auth/create"),

        // ✅ 最後の保険（tsconfigPaths が効かない環境でも @ は src に向ける）
        // tsconfig.json の "@/*": ["./src/*"] と整合する形
        "@": path.resolve(__dirname, "src"),
      },
      dedupe: ["react", "react-dom"],
    },

    clearScreen: false,

    build: {
      sourcemap: true,
      minify: false,
    },

    server: {
      allowedHosts: true,
      host: "0.0.0.0",
      port: 4000,
      hmr: { overlay: false },
      warmup: {
        clientFiles: ["./src/app/**/*", "./src/app/root.tsx", "./src/app/routes.ts"],
      },

      /**
       * ✅ 本番にしたいなら proxy は “オフ” が正解
       * - proxy があると、/api が localhost:3000 に強制転送されてしまう
       *
       * ただし開発でローカルAPIを使いたい時は
       * USE_LOCAL_API=1 を入れて起動すれば proxy が復活する
       */
      proxy: useLocalApi
        ? {
            "/api": "http://localhost:3000",
            "/dev": "http://localhost:3000",
            // （必要なら残してOK：古い互換パス）
            "/attempts": "http://localhost:3000",
            "/me": "http://localhost:3000",
          }
        : undefined,
    },
  };
});
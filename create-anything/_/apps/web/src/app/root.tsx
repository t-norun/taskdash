import type { ReactNode } from "react";
import { useEffect } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from "react-router";

import "./global.css";
import { Toaster } from "sonner";

/* ================================
   ErrorBoundary・・K繝ｻ隗ｦ繧峨↑縺・ｼ・
================================ */
export function ErrorBoundary() {
  const error = useRouteError();
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown error";

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 18, marginBottom: 8 }}>App Error</h1>
      <pre style={{ whiteSpace: "pre-wrap" }}>{message}</pre>
    </div>
  );
}

/* ================================
   Client-only 蜑ｯ菴懃畑髫秘屬
================================ */
function ClientSideEffects() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const API_BASE =
      import.meta.env?.VITE_API_BASE_URL ?? "https://api.taskdash.net";

    const original = window.fetch.bind(window);

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;

      if (url.startsWith("/api/")) {
        return original(`${API_BASE}${url}`, init);
      }

      return original(input as any, init);
    }) as any;

    return () => {
      window.fetch = original as any;
    };
  }, []);

  return null;
}

/* ================================
   Layout・亥憶菴懃畑繧ｼ繝ｭ・・ｼ・
================================ */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <link rel="icon" href="/src/__create/favicon.png" />
      </head>
      <body>
        {children}

        <Toaster position="bottom-right" />
        <ClientSideEffects />

        <ScrollRestoration />
        <Scripts />

        <script
          src="https://kit.fontawesome.com/2c15cc0cc7.js"
          crossOrigin="anonymous"
          async
        />
      </body>
    </html>
  );
}

/* ================================
   App
================================ */
export default function App() {
  return <Outlet />;
}



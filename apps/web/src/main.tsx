<<<<<<< HEAD

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
=======
console.log("VITE_API_BASE_URL =", import.meta.env.VITE_API_BASE_URL);
if (typeof window !== "undefined") {
  const API_BASE =
    (import.meta as any).env?.VITE_API_BASE_URL || "https://taskdash-api.onrender.com";

  const _fetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.startsWith("/api/")) return _fetch(`${API_BASE}${url}`, init);
    return _fetch(input as any, init);
  };
}
import React from "react";
import ReactDOM from "react-dom/client";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL || "https://taskdash-api.onrender.com";

// /api/* を必ずAPIへ向ける（漏れゼロ保険）
if (typeof window !== "undefined") {
  const _fetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.startsWith("/api/")) return _fetch(`${API_BASE}${url}`, init);
    return _fetch(input as any, init);
  };

  console.log("[fetch patched] /api/* →", API_BASE);
}

function App() {
  const [ping, setPing] = React.useState<string>("loading...");

  React.useEffect(() => {
    fetch(`${API_BASE}/ping`)
      .then((r) => r.json())
      .then((d) => setPing(JSON.stringify(d)))
      .catch((e) => setPing(String(e)));
  }, []);

  return (
    <div style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>Task Dash</h1>
      <p>
        API Base: <code>{API_BASE}</code>
      </p>
      <p>
        /ping: <code>{ping}</code>
      </p>
    </div>
  );
}
>>>>>>> split-api

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

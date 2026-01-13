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

const apiBase =
  (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:3000";

function App() {
  const [ping, setPing] = React.useState<string>("loading...");

  React.useEffect(() => {
    fetch(`${apiBase}/ping`)
      .then((r) => r.json())
      .then((d) => setPing(JSON.stringify(d)))
      .catch((e) => setPing(String(e)));
  }, []);

  return (
    <div style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>Task Dash</h1>
      <p>API Base: <code>{apiBase}</code></p>
      <p>/ping: <code>{ping}</code></p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

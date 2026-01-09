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

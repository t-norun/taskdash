
import React from "react";
import ReactDOM from "react-dom/client";

const apiBase =
  (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:3000";

function App() {
  const [ping, setPing] = React.useState<string>("loading...");
  const [tasks, setTasks] = React.useState<string>("loading...");

  React.useEffect(() => {
    // /ping
    fetch(`${apiBase}/ping`)
      .then((r) => r.json())
      .then((d) => setPing(JSON.stringify(d)))
      .catch((e) => setPing(String(e)));

    // /api/tasks
    fetch(`${apiBase}/api/tasks?limit=5&offset=0`)
      .then((r) => r.json())
      .then((d) => setTasks(JSON.stringify(d, null, 2)))
      .catch((e) => setTasks(String(e)));
  }, []);

  return (
    <div style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>Task Dash</h1>

      <p>
        API Base: <code>{apiBase}</code>
      </p>

      <h2>/ping</h2>
      <pre>{ping}</pre>

      <h2>/api/tasks</h2>
      <pre
        style={{
          background: "#f6f8fa",
          padding: 12,
          borderRadius: 6,
          maxHeight: 400,
          overflow: "auto",
        }}
      >
        {tasks}
      </pre>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

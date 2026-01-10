// apps/web/src/App.tsx
import React from "react";

import { apiBase, apiGet } from "./lib/api";
import TaskCard, { Task } from "./components/TaskCard";

function toJST(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

const th: React.CSSProperties = {
  borderBottom: "2px solid #ddd",
  padding: "8px 6px",
  textAlign: "left",
};

const td: React.CSSProperties = {
  borderBottom: "1px solid #eee",
  padding: "8px 6px",
};

export default function App() {
  const [ping, setPing] = React.useState<string>("loading...");
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  function handleClickTask(task: Task) {
    // Step A-2：まずは確認用
    // 次の Step C で Router に置き換える
    alert(`Task clicked\nID: ${task.id}\nTitle: ${task.title}`);
  }

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // /ping
        const pong = await apiGet<any>("/ping");
        if (!cancelled) setPing(JSON.stringify(pong));

        // /api/tasks
        const d = await apiGet<any>("/api/tasks?limit=5&offset=0");
        if (!d?.ok) throw new Error("API error: ok=false");

        if (!cancelled) setTasks(d.tasks ?? []);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message ?? e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>Task Dash</h1>

      <p>
        API Base: <code>{apiBase}</code>
      </p>

      <h2>/ping</h2>
      <pre>{ping}</pre>

      <h2>Tasks</h2>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {tasks.length === 0 ? (
        <p>タスクがありません</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onClick={(task) => {
                alert(`Task clicked\nID: ${task.id}\nTitle: ${task.title}`);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

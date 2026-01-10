// apps/web/src/App.tsx
import React from "react";

import { apiBase, apiGet } from "./lib/api";
import TaskCard, { Task } from "./components/TaskCard";
import { useState } from "react";

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
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "open" | "closed"

  // 正規化関数
  const normalizeStatus = (s: string) => String(s ?? "").toLowerCase();

  // フィルタリング
  const filteredTasks = (tasks ?? []).filter((t) => {
    const st = normalizeStatus(t.status);
    if (statusFilter === "all") return true;
    if (statusFilter === "open") {
      return ["open", "opened", "active", "todo", "in_progress"].includes(st);
    }
    if (statusFilter === "closed") {
      return ["closed", "done", "completed", "complete", "resolved"].includes(st);
    }
    return true;
  });

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

      {/* フィルタボタン */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setStatusFilter("all")}
          aria-pressed={statusFilter === "all"}
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: statusFilter === "all" ? "rgba(255,255,255,0.12)" : "transparent",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          All
        </button>
        <button
          onClick={() => setStatusFilter("open")}
          aria-pressed={statusFilter === "open"}
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: statusFilter === "open" ? "rgba(255,255,255,0.12)" : "transparent",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          Open
        </button>
        <button
          onClick={() => setStatusFilter("closed")}
          aria-pressed={statusFilter === "closed"}
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: statusFilter === "closed" ? "rgba(255,255,255,0.12)" : "transparent",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          Closed
        </button>
      </div>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {filteredTasks.length === 0 ? (
        <p>タスクがありません</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {filteredTasks.map((t) => (
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

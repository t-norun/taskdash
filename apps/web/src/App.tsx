// apps/web/src/App.tsx
import React from "react";
import { apiBase, apiGet } from "./lib/api";

type Task = {
  id: string;
  title: string;
  status: string;
  reward_yen: number;
  created_at: string; // ISO
};

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
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            maxWidth: 900,
          }}
        >
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>タイトル</th>
              <th style={th}>ステータス</th>
              <th style={th}>作成日時（JST）</th>
              <th style={th}>報酬</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td style={td}>{t.id}</td>
                <td style={td}>{t.title}</td>
                <td style={td}>{t.status}</td>
                <td style={td}>{toJST(t.created_at)}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  {t.reward_yen.toLocaleString()} 円
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

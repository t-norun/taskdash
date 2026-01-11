import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiBase, apiGet } from "./lib/api";
// API_BASE_URL: .env等で未定義ならここで仮定義
const API_BASE_URL = typeof apiBase === "string" ? apiBase : "https://taskdash-api.onrender.com";
import TaskCard, { Task } from "./components/TaskCard";

export default function TaskListPage() {
  const [ping, setPing] = React.useState<string>("loading...");
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "open" | "closed"
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

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

  const navigate = useNavigate();

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
              onClick={() => navigate(`/tasks/${t.id}`)}
              disabled={updatingIds.has(t.id)}
              onToggleStatus={async (taskId) => {
                if (updatingIds.has(taskId)) return;

                const current = tasks.find((x) => x.id === taskId);
                if (!current) return;

                const prevStatus = current.status;
                const nextStatus = prevStatus === "open" ? "closed" : "open";

                // PATCH中フラグON
                setUpdatingIds((s) => new Set(s).add(taskId));

                // ✅ Optimistic: 先に一覧を更新
                setTasks((prev) =>
                  prev.map((x) => (x.id === taskId ? { ...x, status: nextStatus } : x))
                );

                try {
                  const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: nextStatus }),
                  });

                  const data = await res.json();

                  if (!res.ok || !data?.ok) {
                    throw new Error(data?.error ?? `HTTP ${res.status}`);
                  }

                  // ✅ 成功: 何もしない（もう反映済み）
                } catch (e: any) {
                  // ✅ 失敗: ロールバック
                  setTasks((prev) =>
                    prev.map((x) => (x.id === taskId ? { ...x, status: prevStatus } : x))
                  );
                  alert(e?.message ?? "更新に失敗しました（ロールバックしました）");
                } finally {
                  // PATCH中フラグOFF
                  setUpdatingIds((s) => {
                    const n = new Set(s);
                    n.delete(taskId);
                    return n;
                  });
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

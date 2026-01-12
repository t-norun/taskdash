import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiBase, apiGet, apiPost } from "./lib/api";
// API_BASE_URL: .env等で未定義ならここで仮定義
const API_BASE_URL =
  typeof apiBase === "string" ? apiBase : "https://taskdash-api.onrender.com";
import TaskCard, { type Task } from "./components/TaskCard";

export default function TaskListPage() {
  const [ping, setPing] = React.useState<string>("loading...");
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "open" | "closed"
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());


  // ===== Toast =====
  const [toast, setToast] = useState<{
    msg: string;
    type?: "success" | "error";
  } | null>(null);
  const toastTimerRef = React.useRef<number | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });

    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2500);
  };
  // =================

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

  // タスク一覧再取得
  const fetchTasks = async () => {
    try {
      // /ping（必要なら残す）
      const pong = await apiGet<any>("/ping");
      setPing(JSON.stringify(pong));

      // /api/tasks
      const d = await apiGet<any>("/api/tasks?limit=5&offset=0");
      if (!d?.ok) throw new Error("API error: ok=false");

      setTasks(d.tasks ?? []);
      setError(null);
      showToast("再取得しました", "success");
    } catch (e: any) {
      setError(String(e?.message ?? e));
      showToast(String(e?.message ?? e), "error");
    }
  };

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (cancelled) return;
        await fetchTasks();
      } finally {
        // no-op
      }
    })();

    return () => {
      cancelled = true;
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // タスク削除
  const handleDelete = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    const ok = window.confirm(`このタスクを削除しますか？\n\n${task?.title ?? ""}`);
    if (!ok) return;

    if (deletingIds.has(taskId)) return;

    // 連打防止
    setDeletingIds((s) => new Set(s).add(taskId));

    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }

      // ✅ 成功: 一覧から除外
      setTasks((prev) => prev.filter((x) => x.id !== taskId));
      showToast("削除しました", "success");
    } catch (e: any) {
      showToast(e?.message ?? "削除に失敗しました", "error");
    } finally {
      setDeletingIds((s) => {
        const n = new Set(s);
        n.delete(taskId);
        return n;
      });
    }
  };


  // タスク更新（編集Save）
  const handleUpdate = async (taskId: string, patch: { title: string; reward_yen: number }) => {
    if (updatingIds.has(taskId)) return;

    setUpdatingIds((s) => new Set(s).add(taskId));
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }

      const updated = json.task ?? json;

      setTasks((prev) => prev.map((x) => (x.id === taskId ? updated : x)));
      showToast("保存しました", "success");
    } catch (e: any) {
      showToast(e?.message ?? "保存に失敗しました", "error");
    } finally {
      setUpdatingIds((s) => {
        const n = new Set(s);
        n.delete(taskId);
        return n;
      });
    }
  };

  const navigate = useNavigate();

  return (
    <div style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>Task Dash</h1>

      <h2>Tasks</h2>
      <p style={{ color: "#666", marginBottom: 16 }}>
        タスクの作成・編集・完了管理ができます
      </p>

      {/* フィルタボタン */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <button
          onClick={() => setStatusFilter("all")}
          aria-pressed={statusFilter === "all"}
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background:
              statusFilter === "all" ? "rgba(255,255,255,0.12)" : "transparent",
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
            background:
              statusFilter === "open" ? "rgba(255,255,255,0.12)" : "transparent",
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
            background:
              statusFilter === "closed"
                ? "rgba(255,255,255,0.12)"
                : "transparent",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          Closed
        </button>

        <div style={{ flex: 1 }} />

        <button
          onClick={fetchTasks}
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "white",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          ↻ 再取得
        </button>
      </div>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {filteredTasks.length === 0 ? (
        <div style={{ padding: 32, color: "#666", textAlign: "center" }}>
          {statusFilter === "all" ? (
            <>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 18 }}>まだタスクがありません。</p>
              <p style={{ margin: "10px 0 0", fontSize: 15 }}>最初のタスクを作ってみましょう。</p>
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 18 }}>該当するタスクがありません。</p>
              <p style={{ margin: "10px 0 0", fontSize: 15 }}>
                フィルタを「All」に戻すか、新しいタスクを作ってみましょう。
              </p>
            </>
          )}

          <button
            onClick={async () => {
              const title = window.prompt("タスク名を入力してください");
              if (!title) return;
              try {
                await apiPost("/api/tasks", { title, reward_yen: 0 });
                setToast?.({ type: "success", msg: "タスクを作成しました" });
                await fetchTasks();
              } catch (e: any) {
                setToast?.({ type: "error", msg: e?.message ?? "作成に失敗しました" });
              }
            }}
            style={{
              marginTop: 24,
              padding: "10px 20px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#f7f7fa",
              fontWeight: 600,
              fontSize: 16,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              transition: "background 0.2s",
            }}
          >
            ＋ タスク作成
          </button>
        </div>
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
              onClick={(task) => navigate(`/tasks/${task.id}`)}
              onDelete={(taskId) => handleDelete(taskId)}
              onUpdate={(taskId, patch) => handleUpdate(taskId, patch)}
              disabled={updatingIds.has(t.id) || deletingIds.has(t.id)}
              isDeleting={deletingIds.has(t.id)}
              isSaving={updatingIds.has(t.id)}
            />
          ))}
        </div>
      )}
      {/* Toast UI */}
      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.12)",
            background: toast.type === "error" ? "#fff5f5" : "#f0fff4",
            boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
            maxWidth: 360,
            zIndex: 9999,
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 14, lineHeight: 1.3 }}>{toast.msg}</div>
          <button
            onClick={() => setToast(null)}
            style={{
              marginLeft: "auto",
              border: "1px solid rgba(0,0,0,0.12)",
              background: "white",
              borderRadius: 10,
              padding: "6px 8px",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

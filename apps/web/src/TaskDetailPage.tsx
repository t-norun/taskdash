import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiBase, apiGet } from "./lib/api";
import TaskCard, { type Task } from "./components/TaskCard";

const API_BASE_URL =
  typeof apiBase === "string" ? apiBase : "https://taskdash-api.onrender.com";

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [task, setTask] = React.useState<Task | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [updating, setUpdating] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // ===== Toast（一覧と同じ簡易版）=====
  const [toast, setToast] = React.useState<{ msg: string; type?: "success" | "error" } | null>(null);
  const timerRef = React.useRef<number | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, 2500);
  };
  // ====================================

  // 1件取得: GET /api/tasks/:id
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!id) throw new Error("id is missing");
        const d = await apiGet<any>(`/api/tasks/${id}`);
        if (!d?.ok) throw new Error(d?.error ?? "API error");
        if (!cancelled) setTask(d.task);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message ?? e));
      }
    })();

    return () => {
      cancelled = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [id]);

  // 更新（Save）
  const handleUpdate = async (taskId: string, patch: { title: string; reward_yen: number }) => {
    if (!task) return;
    if (updating) return;

    setUpdating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      const updated = json.task ?? json;
      setTask(updated);
      showToast("保存しました", "success");
    } catch (e: any) {
      showToast(e?.message ?? "保存に失敗しました", "error");
    } finally {
      setUpdating(false);
    }
  };

  // 削除
  const handleDelete = async (taskId: string) => {
    if (!task) return;
    if (deleting) return;

    const ok = window.confirm(`このタスクを削除しますか？\n\n${task.title}`);
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      showToast("削除しました", "success");
      // 少し待ってから戻る（toast見せる）
      window.setTimeout(() => navigate("/"), 300);
    } catch (e: any) {
      showToast(e?.message ?? "削除に失敗しました", "error");
    } finally {
      setDeleting(false);
    }
  };

  // ステータス切り替え（APIがあるなら）
  const handleToggleStatus = async (taskId: string) => {
    if (!task) return;
    if (updating) return;

    // ここはあなたのAPI次第：
    // - PATCH /api/tasks/:id { status }
    // - PUTで status も更新
    // など。いったん「未実装」でもB-3は進められる。
    showToast("status切り替えはまだ未配線", "error");
  };

  return (
    <div style={{ fontFamily: "system-ui", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            border: "1px solid rgba(0,0,0,0.12)",
            background: "white",
            borderRadius: 10,
            padding: "6px 10px",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          ← Back
        </button>
        <h1 style={{ margin: 0 }}>Task Detail</h1>
      </div>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {!error && !task && <p>loading...</p>}

      {task && (
        <div style={{ maxWidth: 720 }}>
          <TaskCard
            task={task}
            onClick={() => {}}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onToggleStatus={handleToggleStatus}
            disabled={updating || deleting}
            isSaving={updating}
            isDeleting={deleting}
          />
        </div>
      )}

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
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

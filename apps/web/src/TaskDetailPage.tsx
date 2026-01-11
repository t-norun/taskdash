import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

type Task = {
  id: number;
  title: string;
  status: string;
  reward_yen: number;
  created_at: string;
};

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL ??
  "https://taskdash-api.onrender.com";

export default function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false); // ★追加：PATCH中
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<Task | null>(null);

  // ★追加：GETを関数にして、初回＆PATCH後に再利用
  async function fetchTask(taskId: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}`);
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }

      setTask(data.task);
    } catch (e: any) {
      setError(e?.message ?? "fetch failed");
      setTask(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!id) {
        setLoading(false);
        setError("missing id");
        return;
      }

      // fetchTask は state を触るので、cancelled ガードをここでやる
      setLoading(true);
      setError(null);
      setTask(null);

      try {
        const res = await fetch(`${API_BASE}/api/tasks/${id}`);
        const data = await res.json();

        if (!res.ok || !data?.ok) {
          throw new Error(data?.error ?? `HTTP ${res.status}`);
        }

        if (!cancelled) setTask(data.task);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "fetch failed");
        if (!cancelled) setTask(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // ★追加：Detail用の Close/Reopen ハンドラ
  async function onToggleStatus() {
    if (!id || !task) return;

    const prev = task;
    const nextStatus = task.status === "open" ? "closed" : "open";

    // ✅ 先にUI更新（Optimistic）
    setTask({ ...task, status: nextStatus });
    setMutating(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }

      // ✅ 成功：何もしなくてOK（すでにUI更新済み）
      // ただし、サーバー側で正規化される可能性があるなら
      // setTask(data.task) にしてもOK（APIがtask返す場合）
    } catch (e: any) {
      // ✅ 失敗：ロールバック
      setTask(prev);
      setError(e?.message ?? "patch failed");
    } finally {
      setMutating(false);
    }
  }

  const canToggle = !!task && !loading && !mutating;
  const toggleLabel = task?.status === "open" ? "Close" : "Reopen";

  return (
    <div style={{ padding: 16 }}>
      <button onClick={() => navigate(-1)}>← Back</button>

      <h2>Task Detail</h2>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}

      {task && (
        <div
          style={{
            marginTop: 12,
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div>
            <b>ID:</b> {task.id}
          </div>
          <div>
            <b>Title:</b> {task.title}
          </div>
          <div>
            <b>Status:</b> {task.status}
          </div>
          <div>
            <b>Reward:</b> {task.reward_yen} 円
          </div>
          <div>
            <b>Created:</b> {new Date(task.created_at).toLocaleString()}
          </div>

          {/* ★追加：Close/Reopenボタン */}
          <div style={{ marginTop: 12 }}>
            <button
              onClick={onToggleStatus}
              disabled={!canToggle}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #ccc",
                cursor: canToggle ? "pointer" : "not-allowed",
              }}
            >
              {mutating ? "Updating..." : toggleLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

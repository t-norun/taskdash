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
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<Task | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (id) run();
    else {
      setLoading(false);
      setError("missing id");
    }

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div style={{ padding: 16 }}>
      <button onClick={() => navigate(-1)}>← Back</button>

      <h2>Task Detail</h2>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}

      {task && (
        <div style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <div><b>ID:</b> {task.id}</div>
          <div><b>Title:</b> {task.title}</div>
          <div><b>Status:</b> {task.status}</div>
          <div><b>Reward:</b> {task.reward_yen} 円</div>
          <div><b>Created:</b> {new Date(task.created_at).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}

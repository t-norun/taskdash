import { useParams, useNavigate } from "react-router-dom";

export default function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div style={{ padding: 16 }}>
      <button onClick={() => navigate(-1)}>← Back</button>

      <h2>Task Detail</h2>
      <p>Task ID: {id}</p>

      {/* 次ステップでAPIから詳細取得 */}
    </div>
  );
}

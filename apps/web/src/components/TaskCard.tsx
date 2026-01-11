import React from "react";

export type Task = {
  id: string;
  title: string;
  status: string;
  reward_yen: number;
  created_at: string; // ISO
};

// 相対時間表示（JST前提）
function relativeTime(iso: string) {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diffSec = Math.floor((now - t) / 1000);

  if (diffSec < 60) return `${diffSec}秒前`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}分前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}時間前`;
  const day = Math.floor(hour / 24);
  if (day === 1) return "昨日";
  return `${day}日前`;
}

// status → 色
function statusStyle(status: string): React.CSSProperties {
  switch (status) {
    case "open":
      return { background: "#e6f7ef", color: "#0f7a4a" }; // 緑
    case "in_progress":
      return { background: "#e8f1ff", color: "#1e5eff" }; // 青
    case "closed":
      return { background: "#f2f2f2", color: "#666" }; // グレー
    default:
      return { background: "#f5f5f5", color: "#333" };
  }
}

export default function TaskCard({
  task,
  onClick,
  onToggleStatus,
  disabled,
}: {
  task: Task;
  onClick?: (task: Task) => void;
  onToggleStatus?: (taskId: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        ...card,
        cursor: "pointer",
      }}
      onClick={() => {
        console.log("clicked", task.id);
        onClick?.(task);
      }}
    >
      <div style={header}>
        <span style={{ ...badge, ...statusStyle(task.status) }}>
          {task.status}
        </span>
        <span style={time}>{relativeTime(task.created_at)}</span>
      </div>

      <h3 style={title}>{task.title}</h3>

      <div style={footer}>
        <span style={id}>ID: {task.id}</span>
        <span style={reward}>{task.reward_yen.toLocaleString()} 円</span>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleStatus?.(task.id);
        }}
        disabled={disabled}
        style={{
          marginTop: 12,
          padding: "6px 10px",
          border: "1px solid #ddd",
          borderRadius: 8,
          background: "white",
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: 12,
        }}
      >
        {task.status === "closed" ? "Reopen" : "Close"}
      </button>
    </div>
  );
}

/* styles */
const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
  background: "#fff",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 8,
};

const badge: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
};

const time: React.CSSProperties = {
  fontSize: 12,
  color: "#666",
};

const title: React.CSSProperties = {
  margin: "8px 0 12px",
  fontSize: 18,
};

const footer: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 13,
  color: "#555",
};

const id: React.CSSProperties = {};
const reward: React.CSSProperties = { fontWeight: 600 };

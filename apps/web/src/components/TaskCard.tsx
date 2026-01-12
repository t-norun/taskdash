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
  onDelete,
  onUpdate,
  disabled,
  isDeleting,
  isSaving,
}: {
  task: Task;
  onClick?: (task: Task) => void;
  onToggleStatus?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onUpdate?: (taskId: string, patch: { title: string; reward_yen: number }) => void;
  disabled?: boolean;
  isDeleting?: boolean;
  isSaving?: boolean;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [draftTitle, setDraftTitle] = React.useState(task.title);
  const [draftReward, setDraftReward] = React.useState(String(task.reward_yen ?? 0));

  // タスクが外から更新された時に編集状態をリセット（保存成功後の見た目を揃える）
  React.useEffect(() => {
    if (!isEditing) {
      setDraftTitle(task.title);
      setDraftReward(String(task.reward_yen ?? 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.title, task.reward_yen]);

  const editableDisabled = Boolean(disabled || isDeleting || isSaving);

  const onSave = () => {
    const title = draftTitle.trim();
    const rewardNum = Number(draftReward);

    if (!title) return;
    if (!Number.isFinite(rewardNum) || rewardNum < 0) return;

    onUpdate?.(task.id, { title, reward_yen: rewardNum });
    setIsEditing(false);
  };

  const onCancel = () => {
    setDraftTitle(task.title);
    setDraftReward(String(task.reward_yen ?? 0));
    setIsEditing(false);
  };

  return (
    <div
      style={{
        ...card,
        background: isEditing ? "#f8fafc" : "#fff",
        boxShadow: isEditing ? "0 1px 6px rgba(0,0,0,0.08)" : "0 1px 2px rgba(0,0,0,0.04)",
        cursor: isEditing ? "default" : "pointer",
        opacity: editableDisabled && !isEditing ? 0.98 : 1,
      }}
      onClick={() => {
        if (isEditing) return;
        onClick?.(task);
      }}
    >
      <div style={header}>
        <span style={{ ...badge, ...statusStyle(task.status) }}>{task.status}</span>
        <span style={time}>{relativeTime(task.created_at)}</span>
      </div>

      {/* タイトル（編集モード対応） */}
      {!isEditing ? (
        <h3 style={title}>{task.title}</h3>
      ) : (
        <div style={{ display: "grid", gap: 8, margin: "8px 0 12px" }}>
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            disabled={editableDisabled}
            placeholder="タイトル"
            style={input}
          />
          <input
            type="number"
            value={draftReward}
            onChange={(e) => setDraftReward(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            disabled={editableDisabled}
            min={0}
            step={1}
            placeholder="報酬（円）"
            style={input}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSave();
              }}
              disabled={editableDisabled || !draftTitle.trim()}
              style={{
                ...btn,
                background: "#16a34a",
                color: "white",
                border: "1px solid #16a34a",
                cursor: editableDisabled ? "not-allowed" : "pointer",
              }}
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              disabled={editableDisabled}
              style={{
                ...btn,
                background: "#e5e7eb",
                color: "#111827",
                border: "1px solid #e5e7eb",
                cursor: editableDisabled ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={footer}>
        <span style={id}>ID: {task.id}</span>
        <span style={reward}>{task.reward_yen.toLocaleString()} 円</span>
      </div>

      {/* ボタン行（Edit / Close / Delete） */}
      <div style={actions}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isEditing) return;
            setIsEditing(true);
          }}
          disabled={editableDisabled || isEditing}
          style={{
            ...btn,
            background: "#2563eb",
            color: "white",
            border: "1px solid #2563eb",
            cursor: editableDisabled || isEditing ? "not-allowed" : "pointer",
          }}
        >
          Edit
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStatus?.(task.id);
          }}
          disabled={editableDisabled || isEditing}
          style={{
            ...btn,
            cursor: editableDisabled || isEditing ? "not-allowed" : "pointer",
          }}
        >
          {task.status === "closed" ? "Reopen" : "Close"}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(task.id);
          }}
          disabled={editableDisabled || isEditing}
          style={{
            ...btn,
            background: "#dc2626",
            color: "white",
            border: "1px solid #dc2626",
            cursor: editableDisabled || isEditing ? "not-allowed" : "pointer",
            opacity: isDeleting ? 0.7 : 1,
          }}
        >
          {isDeleting ? "Deleting…" : "Delete"}
        </button>
      </div>
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

const actions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 12,
  flexWrap: "wrap",
};

const btn: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #ddd",
  borderRadius: 8,
  background: "white",
  fontSize: 12,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  fontSize: 14,
};

const id: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 12,
};
const reward: React.CSSProperties = { fontWeight: 600 };

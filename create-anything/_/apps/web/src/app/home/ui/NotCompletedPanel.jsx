// apps/web/src/app/home/ui/NotCompletedPanel.jsx
"use client";

import React from "react";

export default function NotCompletedPanel({
  forfeitedLoading,
  forfeitedError,
  notCompletedItems,
  labelOfNotCompleted,
  reasonOfNotCompleted,
  whenOfItem,
  shortId,
}) {
  if (forfeitedLoading) return <div className="text-[13px] text-[#7A7A7A] mt-4">Loading...</div>;
  if (forfeitedError) return <div className="text-[13px] text-[#C33] mt-4">{String(forfeitedError)}</div>;

  const items = Array.isArray(notCompletedItems) ? notCompletedItems : [];
  if (items.length === 0) return <div className="text-[13px] text-[#7A7A7A] mt-4">No items.</div>;

  return (
    <div className="mt-5 grid grid-cols-1 gap-3">
      {items.map((it, idx) => {
        const id = it && (it.attemptId || it.submissionId || it.id) ? it.attemptId || it.submissionId || it.id : idx;
        const when = whenOfItem(it);

        return (
          <div key={String(id)} className="border border-[#F1F1F1] rounded-xl p-4">
            <div className="text-[13px] font-semibold text-[#2B2B2B]">{labelOfNotCompleted(it)}</div>
            <div className="text-[12px] text-[#7A7A7A] mt-1">
              {reasonOfNotCompleted(it)} · {when ? `When: ${when}` : ""} · ID: {shortId(id)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
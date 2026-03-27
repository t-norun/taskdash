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

  const fmtUsdAbs = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "$0.00";
    return `$${(Math.abs(n) / 100).toFixed(2)}`;
  };

  const fmtUsdSigned = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "-$0.00";
    return `-$${(Math.abs(n) / 100).toFixed(2)}`;
  };

  return (
    <div className="mt-5 grid grid-cols-1 gap-3">
      {items.map((it, idx) => {
        const id = it && (it.attemptId || it.submissionId || it.id) ? it.attemptId || it.submissionId || it.id : idx;
        const when = whenOfItem(it);

        const stakeCents =
          typeof it?.stakeCents === "number"
            ? it.stakeCents
            : typeof it?.priceCents === "number"
              ? it.priceCents
              : typeof it?.entryFeeCents === "number"
                ? it.entryFeeCents
                : null;

        return (
          <div key={String(id)} className="border border-[#F1F1F1] rounded-xl p-4">
            <div className="text-[13px] font-semibold text-[#2B2B2B]">
              {labelOfNotCompleted(it)}
            </div>

            {stakeCents != null ? (
              <>
                <div className="text-[13px] text-[#2B2B2B] mt-2">
                  Tier: {fmtUsdAbs(stakeCents)}
                </div>
                <div className="text-[13px] font-semibold text-[#DC2626] mt-1">
                  Deducted: {fmtUsdSigned(stakeCents)}
                </div>
              </>
            ) : null}

            <div className="text-[12px] text-[#7A7A7A] mt-2">
              {reasonOfNotCompleted(it)} {when ? `· When: ${when}` : ""} · ID: {shortId(id)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
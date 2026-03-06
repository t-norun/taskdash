// apps/web/src/app/home/ui/WaitingPanel.jsx
"use client";

import React from "react";

export default function WaitingPanel({
  waitingError,
  filteredWaitingList,
  waitingPriceFilter,
  setWaitingPriceFilter,
  PRICE_OPTIONS,
  waitingLoading,
  nowMs,
  fmtWhenShort,
  fmtRemainingHm,
  shortId,
}) {
  if (waitingError) return <div className="text-[13px] text-[#C33] mt-4">{String(waitingError)}</div>;

  const list = Array.isArray(filteredWaitingList) ? filteredWaitingList : [];
  if (list.length === 0) return <div className="text-[13px] text-[#7A7A7A] mt-4">No waiting items.</div>;

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] text-[#7A7A7A]">
          Filter:
          <select
            value={waitingPriceFilter}
            onChange={(e) => setWaitingPriceFilter(e.target.value)}
            className="ml-2 h-[30px] border border-[#E5E5E5] rounded px-2 text-[12px]"
          >
            <option value="all">All</option>
            {PRICE_OPTIONS.map((p) => (
              <option key={p} value={String(p)}>
                ${p}
              </option>
            ))}
          </select>
        </div>

        <div className="text-[12px] text-[#7A7A7A]">{waitingLoading ? "Updating..." : "Auto-updating"}</div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3">
        {list.map((w, idx) => {
          const sid = (w && w.submissionId) || idx;
          const priceUsd =
            w && w.priceUsd != null && Number.isFinite(Number(w.priceUsd))
              ? Number(w.priceUsd)
              : w && w.stakeCents != null
              ? Number(w.stakeCents) / 100
              : null;

          let remainingMs = w && w.remainingMs != null ? Number(w.remainingMs) : null;
          if (!Number.isFinite(remainingMs) && w && w.expiresAt) {
            const t = new Date(w.expiresAt).getTime();
            if (Number.isFinite(t)) remainingMs = Math.max(0, t - nowMs);
          }

          return (
            <div key={String(sid)} className="border border-[#F1F1F1] rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[#2B2B2B]">
                    Waiting · Tier {priceUsd != null ? `$${Number(priceUsd).toFixed(2)}` : "—"}
                  </div>
                  <div className="text-[12px] text-[#7A7A7A] mt-1">
                    ID: {shortId(sid)} · Saved: {w && w.savedAt ? fmtWhenShort(w.savedAt) : ""}
                  </div>
                  {remainingMs != null ? (
                    <div className="text-[12px] text-[#F59E0B] mt-1">Refund in: {fmtRemainingHm(remainingMs)}</div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const attemptId = (w && (w.attemptId || w.submissionId)) || "";
                    if (!attemptId) return;
                    window.location.href = `/task?attemptId=${encodeURIComponent(String(attemptId))}`;
                  }}
                  className="shrink-0 h-[36px] px-4 rounded-lg border border-[#E5E5E5] text-[12px] font-semibold text-[#2B2B2B] hover:border-[#2563FF]"
                >
                  Open
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
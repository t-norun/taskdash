// apps/web/src/app/home/ui/WaitingPanel.jsx
"use client";

import React, { useMemo } from "react";

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
  if (waitingError) {
    return <div className="text-[13px] text-[#C33] mt-4">{String(waitingError)}</div>;
  }

  const list = Array.isArray(filteredWaitingList) ? filteredWaitingList : [];

  const grouped = useMemo(() => {
    const map = {};
    PRICE_OPTIONS.forEach((p) => {
      map[p] = [];
    });

    for (const w of list) {
      const priceUsd =
        w && w.priceUsd != null && Number.isFinite(Number(w.priceUsd))
          ? Number(w.priceUsd)
          : w && w.stakeCents != null
          ? Number(w.stakeCents) / 100
          : null;

      if (priceUsd == null) continue;

      const key = Math.round(priceUsd);
      if (!map[key]) map[key] = [];
      map[key].push(w);
    }

    return map;
  }, [list, PRICE_OPTIONS]);

  const visibleTiers =
    waitingPriceFilter === "all"
      ? PRICE_OPTIONS
      : PRICE_OPTIONS.filter((p) => Number(waitingPriceFilter) === Number(p));

  const totalVisibleCount = visibleTiers.reduce((sum, tier) => {
    return sum + Number((grouped[tier] || []).length);
  }, 0);

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setWaitingPriceFilter("all")}
            className={[
              "h-[32px] px-3 rounded-lg border text-[12px] font-semibold transition",
              waitingPriceFilter === "all"
                ? "bg-[#2B2B2B] text-white border-[#2B2B2B]"
                : "bg-white text-[#2B2B2B] border-[#E5E5E5] hover:border-[#2563FF]",
            ].join(" ")}
          >
            All ({list.length})
          </button>

          {PRICE_OPTIONS.map((p) => {
            const count = Number((grouped[p] || []).length);
            const active = Number(waitingPriceFilter) === Number(p);

            return (
              <button
                key={p}
                type="button"
                onClick={() => setWaitingPriceFilter(String(p))}
                className={[
                  "h-[32px] px-3 rounded-lg border text-[12px] font-semibold transition",
                  active
                    ? "bg-[#2563FF] text-white border-[#2563FF]"
                    : "bg-white text-[#2B2B2B] border-[#E5E5E5] hover:border-[#2563FF]",
                ].join(" ")}
              >
                ${p} ({count})
              </button>
            );
          })}
        </div>

        <div className="text-[12px] text-[#7A7A7A]">
          {waitingLoading ? "Updating..." : "Auto-updating"}
        </div>
      </div>

      {totalVisibleCount === 0 ? (
        <div className="text-[13px] text-[#7A7A7A] mt-4">No waiting items.</div>
      ) : (
        <div className="mt-4 space-y-5">
          {visibleTiers.map((tier) => {
            const items = grouped[tier] || [];
            if (items.length === 0) return null;

            return (
              <div key={tier}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[13px] font-semibold text-[#2B2B2B]">
                    ${tier} Tier
                  </div>
                  <div className="text-[12px] text-[#7A7A7A]">{items.length} waiting</div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {items.map((w, idx) => {
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
                              <div className="text-[12px] text-[#F59E0B] mt-1">
                                Refund in: {fmtRemainingHm(remainingMs)}
                              </div>
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
          })}
        </div>
      )}
    </div>
  );
}
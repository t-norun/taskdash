// apps/web/src/app/home/ui/RecentResultsPanel.jsx
"use client";

import React from "react";

export default function RecentResultsPanel({
  recentLoading,
  recentError,
  recentMatches,
  isDemo,
  fmtWhenShort,
  fmtElapsed,
  centsToUsd,
  shortId,
}) {
  if (recentLoading) return <div className="text-[13px] text-[#7A7A7A] mt-4">Loading recent results...</div>;
  if (recentError) return <div className="text-[13px] text-[#C33] mt-4">{String(recentError)}</div>;

  const items = Array.isArray(recentMatches) ? recentMatches : [];
  if (items.length === 0) return <div className="text-[13px] text-[#7A7A7A] mt-4">No recent results yet.</div>;

  return (
    <div className="mt-5 grid grid-cols-1 gap-3">
      {items.map((it, idx) => {
        const id = it.id || it.matchId || it.submissionId || it.attemptId || idx;
        const outcome = String(it.outcome || "").toLowerCase();
        const when = it.settledAt || it.createdAt || it.updatedAt || null;

        const priceUsd =
          typeof it.priceUsd === "number"
            ? it.priceUsd
            : typeof it.stakeCents === "number"
              ? centsToUsd(it.stakeCents)
              : null;

        const youScore = it.my && typeof it.my.score === "number" ? it.my.score : it.playerScore;
        const peerScore = it.opponent && typeof it.opponent.score === "number" ? it.opponent.score : it.cpuScore;

        const youTimeMs = it.my && typeof it.my.timeMs === "number" ? it.my.timeMs : it.playerTimeMs;
        const peerTimeMs = it.opponent && typeof it.opponent.timeMs === "number" ? it.opponent.timeMs : it.cpuTimeMs;

        const rewardTier =
          outcome === "win"
            ? "Higher reward"
            : outcome === "lose"
              ? "Standard reward"
              : outcome === "tie" || outcome === "draw"
                ? "Equal reward"
                : outcome
                  ? outcome
                  : "—";

        const payoutCents =
          typeof it.userPayoutCents === "number"
            ? it.userPayoutCents
            : outcome === "win"
              ? (typeof it.payoutWinnerCents === "number" ? it.payoutWinnerCents : null)
              : outcome === "lose"
                ? (typeof it.payoutLoserCents === "number" ? it.payoutLoserCents : null)
                : outcome === "tie" || outcome === "draw"
                  ? (typeof it.payoutWinnerCents === "number" ? it.payoutWinnerCents : null)
                  : null;

        return (
          <div key={String(id)} className="border border-[#F1F1F1] rounded-xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                {payoutCents != null ? (
                  <div className="text-[16px] font-bold text-green-600 mb-1">
                    Payout: +${centsToUsd(payoutCents).toFixed(2)}
                  </div>
                ) : null}

                <div className="text-[13px] font-semibold text-[#2B2B2B]">
                  Reward tier: <span className="font-bold">{rewardTier}</span>
                  {priceUsd != null ? (
                    <span className="text-[#7A7A7A] font-medium"> · Tier ${Number(priceUsd).toFixed(2)}</span>
                  ) : null}
                </div>

                <div className="text-[12px] text-[#7A7A7A] mt-1">
                  {when ? fmtWhenShort(when) : ""} · ID: {shortId(id)}
                </div>
              </div>

              {!isDemo && it.matchId ? (
                <button
                  type="button"
                  onClick={() => (window.location.href = `/match?matchId=${encodeURIComponent(String(it.matchId))}`)}
                  className="shrink-0 h-[36px] px-4 rounded-lg border border-[#E5E5E5] text-[12px] font-semibold text-[#2B2B2B] hover:border-[#2563FF]"
                >
                  Open
                </button>
              ) : null}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-[#F1F1F1] p-3">
                <div className="text-[12px] text-[#7A7A7A]">You</div>
                <div className="text-[14px] font-semibold text-[#2B2B2B] mt-1">
                  Score: {youScore != null ? String(youScore) : "—"} · Time: {youTimeMs != null ? fmtElapsed(youTimeMs) : "—"}
                </div>
              </div>

              <div className="rounded-lg border border-[#F1F1F1] p-3">
                <div className="text-[12px] text-[#7A7A7A]">Reference</div>
                <div className="text-[14px] font-semibold text-[#2B2B2B] mt-1">
                  Score: {peerScore != null ? String(peerScore) : "—"} · Time: {peerTimeMs != null ? fmtElapsed(peerTimeMs) : "—"}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
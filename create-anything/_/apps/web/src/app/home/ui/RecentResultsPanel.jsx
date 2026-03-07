"use client";

import React from "react";

export default function RecentResultsPanel({
  recentLoading,
  recentError,
  recentMatches,
  fmtWhenShort,
  fmtElapsed,
  centsToUsd,
  shortId,
}) {
  if (recentLoading) {
    return <div className="text-[13px] text-[#7A7A7A] mt-4">Loading recent results...</div>;
  }

  if (recentError) {
    return <div className="text-[13px] text-[#C33] mt-4">{String(recentError)}</div>;
  }

  const items = Array.isArray(recentMatches) ? recentMatches : [];

  if (!items.length) {
    return <div className="text-[13px] text-[#7A7A7A] mt-4">No recent results yet.</div>;
  }

  return (
    <div className="mt-5 grid grid-cols-1 gap-3">
      {items.map((it, idx) => {
        const id = it.matchId || it.submissionId || idx;

        const youScore = Number(it.playerScore ?? 0);
        const oppScore = Number(it.cpuScore ?? 0);

        const youTime = it.playerTimeMs ?? null;
        const oppTime = it.cpuTimeMs ?? null;

        const diff = youScore - oppScore;

        let label = "Tie";
        if (diff > 0) label = "Higher Ranked";
        if (diff < 0) label = "Lower Ranked";

        return (
          <div key={id} className="border border-[#F1F1F1] rounded-xl p-4">

            <div className="text-[13px] font-semibold text-[#2B2B2B]">
              Evaluation Result: <span className="font-bold">{label}</span>
            </div>

            <div className="text-[12px] text-[#7A7A7A] mt-1">
              Score Difference: {diff >= 0 ? "+" : ""}{diff}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">

              <div className="rounded-lg border border-[#F1F1F1] p-3">
                <div className="text-[12px] text-[#7A7A7A]">You</div>
                <div className="text-[14px] font-semibold text-[#2B2B2B] mt-1">
                  Score: {youScore} · Time: {youTime ? fmtElapsed(youTime) : "-"}
                </div>
              </div>

              <div className="rounded-lg border border-[#F1F1F1] p-3">
                <div className="text-[12px] text-[#7A7A7A]">Opponent</div>
                <div className="text-[14px] font-semibold text-[#2B2B2B] mt-1">
                  Score: {oppScore} · Time: {oppTime ? fmtElapsed(oppTime) : "-"}
                </div>
              </div>

            </div>

            <div className="text-[12px] text-[#7A7A7A] mt-2">
              {fmtWhenShort(it.createdAt)} · ID: {shortId(id)}
            </div>

          </div>
        );
      })}
    </div>
  );
}

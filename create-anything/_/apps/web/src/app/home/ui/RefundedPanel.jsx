// apps/web/src/app/home/ui/RefundedPanel.jsx
"use client";

import React from "react";

export default function RefundedPanel({ refundedItems, fmtWhenShort, shortId }) {
  const items = Array.isArray(refundedItems) ? refundedItems : [];
  if (items.length === 0) return <div className="text-[13px] text-[#7A7A7A] mt-4">No refunded items.</div>;

  const fmtUsdAbs = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "$0.00";
    return `$${(Math.abs(n)).toFixed(2)}`;
  };

  return (
    <div className="mt-5 grid grid-cols-1 gap-3">
      {items.map((it, idx) => {
        const id = (it && it.submissionId) || idx;

        const priceUsd =
          typeof it?.priceUsd === "number"
            ? it.priceUsd
            : typeof it?.stakeCents === "number"
              ? it.stakeCents / 100
              : null;

        const when = it && (it.createdAt || it.savedAt) ? fmtWhenShort(it.createdAt || it.savedAt) : "";
        const reason = (it && it.reason) || "refunded";

        return (
          <div key={String(id)} className="border border-[#F1F1F1] rounded-xl p-4">
            <div className="text-[13px] font-semibold text-[#2B2B2B]">
              Refunded
            </div>

            {priceUsd != null ? (
              <>
                <div className="text-[13px] text-[#2B2B2B] mt-2">
                  Tier: {fmtUsdAbs(priceUsd)}
                </div>
                <div className="text-[13px] font-semibold text-[#059669] mt-1">
                  Refunded: +${fmtUsdAbs(priceUsd).replace("$", "")}
                </div>
              </>
            ) : null}

            <div className="text-[12px] text-[#7A7A7A] mt-2">
              {when} · ID: {shortId(id)}
            </div>

            <div className="text-[12px] text-[#7A7A7A] mt-1">
              Reason: {String(reason)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
// apps/web/src/app/home/ui/RefundedPanel.jsx
"use client";

import React from "react";

export default function RefundedPanel({
  refundedItems,
  fmtWhenShort,
  shortId,
}) {
  const items = Array.isArray(refundedItems) ? refundedItems : [];

  if (items.length === 0) {
    return <div className="text-[13px] text-[#7A7A7A] mt-4">No refunded items.</div>;
  }

  return (
    <div className="mt-5 grid grid-cols-1 gap-3">
      {items.map((it, idx) => {
        const id = (it && it.submissionId) || (it && it.id) || idx;
        const price =
          it && it.priceUsd != null
            ? `$${Number(it.priceUsd).toFixed(2)}`
            : "-";
        const when =
          it && (it.createdAt || it.savedAt)
            ? fmtWhenShort(it.createdAt || it.savedAt)
            : "-";
        const reason = (it && it.reason) || "refunded";

        return (
          <div
            key={String(id)}
            className="border border-[#F1F1F1] rounded-xl p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[#2B2B2B]">
                  Refunded
                  <span className="text-[#7A7A7A] font-medium"> · {price}</span>
                </div>

                <div className="text-[12px] text-[#7A7A7A] mt-1">
                  {when} · ID: {shortId ? shortId(id) : String(id)}
                </div>
              </div>
            </div>

            <div className="mt-3 text-[13px] text-[#5A5A5A]">
              Reason: {String(reason)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

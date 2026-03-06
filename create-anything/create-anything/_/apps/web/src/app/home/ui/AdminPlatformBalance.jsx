// apps/web/src/app/home/ui/AdminPlatformBalance.jsx
"use client";

import React, { useCallback, useEffect, useState } from "react";

export default function AdminPlatformBalance({ getPlatformBalance }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [balanceUsd, setBalanceUsd] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  const parseUsd = (res) => {
    const pick = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
    let usd = null;
    if (res) {
      usd = pick(res.balanceUsd) ?? pick(res.platformBalanceUsd) ?? pick(res.availableUsd);
      const balanceCents = pick(res.balanceCents);
      if (usd == null && balanceCents != null) usd = balanceCents / 100;
      const platformBalanceCents = pick(res.platformBalanceCents);
      if (usd == null && platformBalanceCents != null) usd = platformBalanceCents / 100;
      if (usd == null && pick(res.balance) != null) usd = pick(res.balance);
    }
    return usd;
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await getPlatformBalance();
      if (!r || !r.ok) throw new Error((r && r.error) || "failed");
      const usd = parseUsd(r);
      setBalanceUsd(usd);
      setUpdatedAt(Date.now());
    } catch (e) {
      setErr(String((e && e.message) || e));
      setBalanceUsd(null);
      setUpdatedAt(null);
    } finally {
      setLoading(false);
    }
  }, [getPlatformBalance]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="bg-white border border-[#E7E7E7] rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-[#2B2B2B]">Platform Balance</div>
          <div className="text-[12px] text-[#7A7A7A] mt-1">Admin-only. Read-only display.</div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="shrink-0 h-[36px] px-4 rounded-lg border border-[#E5E5E5] text-[12px] font-semibold text-[#2B2B2B] hover:border-[#2563FF] disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="mt-5 rounded-xl border border-[#F1F1F1] bg-white p-5">
        {err ? (
          <div className="rounded-xl border border-[#EF4444] bg-[#FEF2F2] px-4 py-3 text-[13px] text-[#991B1B]">{err}</div>
        ) : (
          <>
            <div className="text-[12px] text-[#7A7A7A] mb-1">Current</div>
            <div className="text-[32px] font-semibold text-[#2B2B2B]">
              {balanceUsd == null ? " E : `$${Number(balanceUsd).toFixed(2)}`}
            </div>
            <div className="mt-2 text-[12px] text-[#9CA3AF]">
              {updatedAt ? `Last updated: ${new Date(updatedAt).toLocaleString()}` : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


"use client";

import React, { useEffect, useState } from "react";
import { authenticatedFetch } from "@/utils/auth";

// 通貨表示ユーティリティ
export function formatUSD(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

export default function PayPalSuccessPage() {
  const [status, setStatus] = useState("processing"); // processing | success | error
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState(0);
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token"); // PayPal token = orderId

    if (!token) {
      setStatus("error");
      setMessage("No token found in URL");
      return;
    }

    const guardKey = `pp_capture_done:${token}`;

    const fetchBalance = async () => {
      const r2 = await authenticatedFetch("/api/user/balance", { method: "GET" });
      const t2 = await r2.text();
      let b = null;
      try {
        b = JSON.parse(t2);
      } catch {}
      if (!r2.ok) throw new Error(b?.error || t2 || `balance failed (${r2.status})`);
      setBalance(b);
      return b;
    };

    const run = async () => {
      try {
        // すでにこのセッションで処理済みなら capture をスキップして表示を復元
        if (sessionStorage.getItem(guardKey) === "1") {
          setStatus("success");
          setMessage("Already processed (session).");

          // 保存済み金額を復元（過去確認用）
          const saved = Number(sessionStorage.getItem(`pp_amount_${token}`) || 0);
          setAmount(saved);

          await fetchBalance();
          return;
        }

        // capture
        const r = await authenticatedFetch("/api/paypal/capture-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: token }),
        });

        const t = await r.text();
        let j = null;
        try {
          j = JSON.parse(t);
        } catch {}

        if (!r.ok) throw new Error(j?.error || t || `capture failed (${r.status})`);

        // 金額計算: captured.value → amount → deposit.units/100
        const capturedAmount =
          Number(j?.captured?.value ?? j?.amount ?? 0) ||
          Number(j?.deposit?.units ?? 0) / 100;

        setStatus("success");
        setAmount(capturedAmount);

        // alreadyApplied の場所は j.deposit.alreadyApplied のはずなので両対応
        const already =
          Boolean(j?.deposit?.alreadyApplied ?? j?.alreadyApplied ?? false);

        setMessage(
          already
            ? "Already applied."
            : `+$${capturedAmount.toFixed(2)} added.`
        );

        // 今回の入金額を保存（過去確認用）
        sessionStorage.setItem(`pp_amount_${token}`, String(capturedAmount));
        sessionStorage.setItem(guardKey, "1");

        // 残高即更新
        await fetchBalance();

        // 成功時は1.2秒後にトップへ戻る
        setTimeout(() => {
          window.location.href = "/";
        }, 1200);
      } catch (e) {
        setStatus("error");
        setMessage(e instanceof Error ? e.message : String(e));
      }
    };

    run();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        fontFamily: "system-ui",
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: "100%",
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18 }}>PayPal Result</h1>

        {status === "processing" && <p style={{ marginTop: 12 }}>Processing…</p>}

        {status === "success" && (
          <div style={{ marginTop: 12 }}>
            <p>{message}</p>
            <p style={{ fontWeight: 700 }}>+${amount.toFixed(2)}</p>

            {/* ユーザー向け残高表示 */}
            {balance && typeof balance.balance === "number" && (
              <p style={{ fontWeight: 700, fontSize: 20 }}>
                Balance: {formatUSD(balance.balance)}
              </p>
            )}

            {balance && (
              <pre
                style={{
                  background: "#fafafa",
                  padding: 12,
                  borderRadius: 8,
                  overflow: "auto",
                }}
              >
                {JSON.stringify(balance, null, 2)}
              </pre>
            )}

            <p style={{ color: "#666", fontSize: 12 }}>Redirecting…</p>
          </div>
        )}

        {status === "error" && (
          <div style={{ marginTop: 12 }}>
            <p style={{ color: "crimson" }}>{message}</p>
            <a href="/">Back</a>
          </div>
        )}
      </div>
    </div>
  );
}


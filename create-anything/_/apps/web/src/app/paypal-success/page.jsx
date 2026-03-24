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

      if (!r2.ok) {
        throw new Error(b?.error || t2 || `balance failed (${r2.status})`);
      }

      setBalance(b);
      return b;
    };

    const run = async () => {
      try {
        // すでにこのセッションで処理済みなら capture をスキップ
        if (sessionStorage.getItem(guardKey) === "1") {
          const saved = Number(sessionStorage.getItem(`pp_amount_${token}`) || 0);

          setStatus("success");
          setAmount(saved);
          setMessage("Deposit completed.");

          await fetchBalance();

          setTimeout(() => {
            window.location.href = "/";
          }, 1200);

          return;
        }

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

        if (!r.ok) {
          throw new Error(j?.error || t || `capture failed (${r.status})`);
        }

        // 金額計算
        const capturedAmount =
          Number(j?.captured?.value ?? j?.amount ?? 0) ||
          Number(j?.deposit?.units ?? 0) / 100;

        const already = Boolean(j?.deposit?.alreadyApplied ?? j?.alreadyApplied ?? false);

        setStatus("success");
        setAmount(capturedAmount);
        setMessage(already ? "This deposit was already applied." : "Deposit completed successfully.");

        sessionStorage.setItem(`pp_amount_${token}`, String(capturedAmount));
        sessionStorage.setItem(guardKey, "1");

        await fetchBalance();

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
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: "100%",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>PayPal Deposit</h1>

        {status === "processing" && (
          <div style={{ marginTop: 16 }}>
            <p style={{ margin: 0, fontSize: 15, color: "#374151" }}>Processing your payment...</p>
            <p style={{ marginTop: 8, fontSize: 13, color: "#6b7280" }}>
              Please wait a moment.
            </p>
          </div>
        )}

        {status === "success" && (
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                background: "#ecfdf5",
                color: "#065f46",
                fontWeight: 600,
              }}
            >
              {message}
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Added amount</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#111827", marginTop: 4 }}>
                +${amount.toFixed(2)}
              </div>
            </div>

            {balance && typeof balance.balance === "number" && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 13, color: "#6b7280" }}>Current balance</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginTop: 4 }}>
                  {formatUSD(balance.balance)}
                </div>
              </div>
            )}

            <p style={{ marginTop: 18, color: "#6b7280", fontSize: 12 }}>
              Redirecting to home...
            </p>
          </div>
        )}

        {status === "error" && (
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                background: "#fef2f2",
                color: "#b91c1c",
                fontWeight: 600,
              }}
            >
              Payment processing failed.
            </div>

            <p style={{ marginTop: 12, color: "#7f1d1d", fontSize: 14 }}>{message}</p>

            <a
              href="/"
              style={{
                display: "inline-block",
                marginTop: 12,
                color: "#2563eb",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Back to home
            </a>
          </div>
        )}
      </div>
    </div>
  );
}


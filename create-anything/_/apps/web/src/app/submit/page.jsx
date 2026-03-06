"use client";

import { useEffect, useState } from "react";
import { navigate } from "@/utils/navigation";
import { authenticatedFetch, isAuthenticated, getUser } from "@/utils/auth";

const PENDING_KEY = "pendingSubmission";

const formatUsdFromCents = (cents) =>
  `$${(Number(cents || 0) / 100).toFixed(2)}`;

function loadPending() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function SubmitPage() {
  const [user, setUser] = useState(null);
  const [pending, setPending] = useState(null);

  const [balance, setBalance] = useState(0);
  const [reserved, setReserved] = useState(0);
  const [available, setAvailable] = useState(0);
  const [tickets, setTickets] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(true);

  const [market, setMarket] = useState([]);
  const [loadingMarket, setLoadingMarket] = useState(true);

  const [stakeTickets, setStakeTickets] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  // wallet一本化: availableから計算。maxStake / tickets 表示を統一
  const availableCents = Number(available ?? 0);
  const maxStake = Math.max(0, Math.floor(availableCents / 100));
  const ticketsDisplay = maxStake;
  const canStake = maxStake >= 1;
  const stakeDisabledReason = canStake
    ? null
    : "残高が $1 未満のため参加できません";

  // ===== init =====
  useEffect(() => {
    (async () => {
      const ok = await Promise.resolve(isAuthenticated()).catch(() => false);
      if (!ok) {
        navigate("/login");
        return;
      }

      const u = await Promise.resolve(getUser()).catch(() => null);
      if (u) setUser(u);

      const p = loadPending();

      // pending が無い / 壊れている場合は戻さない
      if (!p?.attemptId) {
        // attemptId がクエリにあるなら results へ
        const qs = new URLSearchParams(window.location.search);
        const aid = qs.get("attemptId");
        if (aid) {
          window.location.href = `/results?attemptId=${encodeURIComponent(aid)}`;
          return;
        }
        setPending(null);
        return;
      }

      if (!Array.isArray(p?.orderedNumbers)) {
        setPending(null);
        return;
      }

      // timeMs は 0 でもOK。number かだけ確認
      const tm = Number(p?.timeMs);
      if (!Number.isFinite(tm)) {
        setPending(null);
        return;
      }

      setPending({ ...p, timeMs: tm });
    })();
  }, []);

  // ===== balance =====
  useEffect(() => {
    if (!pending) return;

    (async () => {
      setLoadingBalance(true);
      setErr("");
      try {
        const r = await authenticatedFetch("/api/user/balance");
        const j = await r.json();
        if (!j?.ok) throw new Error(j?.error || "balance failed");

        setBalance(Number(j.balance ?? 0));
        setReserved(Number(j.reserved ?? 0));
        setAvailable(Number(j.available ?? 0));
        setTickets(Number(j.tickets ?? 0));
      } catch (e) {
        setErr(String(e?.message || e));
      } finally {
        setLoadingBalance(false);
      }
    })();
  }, [pending]);

  // maxStakeに合わせて stakeTickets を矯正
  useEffect(() => {
    if (!pending) return;

    if (maxStake <= 0) {
      setStakeTickets(0);
      return;
    }

    setStakeTickets((v) => {
      const n = Number(v || 1);
      if (n < 1) return 1;
      if (n > maxStake) return maxStake;
      return n;
    });
  }, [maxStake, pending]);

  async function reloadMarket() {
    setLoadingMarket(true);
    setErr("");

    try {
      const r = await authenticatedFetch("/api/tasks/market");
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "market failed");
      setMarket(Array.isArray(j.buckets) ? j.buckets : []);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoadingMarket(false);
    }
  }

  // ===== market poll =====
  useEffect(() => {
    if (!pending) return;

    reloadMarket();
    const t = setInterval(reloadMarket, 2000);
    return () => clearInterval(t);
  }, [pending]);

  async function doSubmit() {
    if (!pending) return;
    if (submitting) return;

    // stakeTickets = USD として扱う。1 ticket = $1
    const stakeUsd = Math.floor(Number(stakeTickets ?? 0));

    if (!Number.isFinite(stakeUsd) || stakeUsd < 1) {
      alert("チケット枚数を選んでください");
      return;
    }

    if (stakeUsd > maxStake) {
      alert("所持チケット数を超えています");
      return;
    }

    setSubmitting(true);
    setErr("");

    try {
      // v2 submit の仕様
      // stakeUsd のとき N = stakeUsd になる想定
      const N = stakeUsd;

      // ダミー採点
      const scores = Array.from({ length: N }, () => 80);
      const timesMs = Array.from({ length: N }, () =>
        Math.max(1, Math.trunc(Number(pending?.timeMs ?? 1500)))
      );

      const body = {
        attemptId: pending.attemptId,
        stakeUsd,
        taskId: pending?.taskId ?? "dev-task",
        scores,
        timesMs,
      };

      const res = await authenticatedFetch("/api/tasks/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const j = typeof res?.json === "function" ? await res.json() : res;

      if (!j?.ok) throw new Error(j?.error || "submit failed");

      console.log("submit response =", j);

      try {
        localStorage.removeItem(PENDING_KEY);
      } catch {}

      // waiting をホーム側に引き継ぐ
      const sid = j.submissionId || body.attemptId;
      if (sid) {
        localStorage.setItem(
          "pendingSubmission",
          JSON.stringify({
            attemptId: sid,
            taskId: body.taskId,
            orderedNumbers: pending.orderedNumbers,
            timeMs: pending.timeMs,
          })
        );
        localStorage.setItem("lastSubmissionId", sid);
        localStorage.setItem("taskdash_v2_submissionId", sid);
      }

      window.location.href = "/";
      return;
    } catch (e) {
      setErr(String(e?.message || e));
      setSubmitting(false);
    }
  }

  if (!pending) {
    return (
      <div style={{ padding: 16, maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Submit</h1>
        <p style={{ marginTop: 12 }}>
          pendingSubmission がありません。すでに提出済みか、別タブ・別遷移で開いた可能性があります。
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button
            onClick={() => navigate("/")}
            style={{ padding: 12, borderRadius: 12, border: "1px solid #ccc" }}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>Submit</h1>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 12,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 6 }}>
          今回の結果（ローカル保存済み）
        </div>
        <div>Time: {(Number(pending.timeMs) / 1000).toFixed(3)}s</div>
        <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>
          attemptId: {pending.attemptId}
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 12,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 6 }}>チケット残高</div>
        {loadingBalance ? (
          <div>Loading...</div>
        ) : (
          <>
            <div>Balance: {formatUsdFromCents(balance)}</div>
            <div>Reserved: {formatUsdFromCents(reserved)}</div>
            <div style={{ fontWeight: 800 }}>
              Available: {formatUsdFromCents(available)}
            </div>
            <div style={{ marginTop: 6, opacity: 0.8 }}>
              Tickets: <b>{ticketsDisplay}</b> / Max stake: <b>{maxStake}</b>
            </div>
          </>
        )}
      </div>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 12,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 6 }}>
          今回出す枚数（stake）
        </div>

        {!canStake ? (
          <div style={{ marginTop: 8, color: "tomato" }}>
            {stakeDisabledReason}
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              {[1, 2, 3, 5, 10].map((n) => (
                <button
                  key={n}
                  disabled={n > maxStake}
                  onClick={() => setStakeTickets(n)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #ccc",
                    fontWeight: stakeTickets === n ? 900 : 600,
                    opacity: n > maxStake ? 0.4 : 1,
                  }}
                >
                  {n}
                </button>
              ))}

              <span style={{ marginLeft: 8, opacity: 0.7 }}>custom:</span>

              <input
                type="number"
                min={1}
                max={maxStake}
                value={stakeTickets}
                onChange={(e) => setStakeTickets(Number(e.target.value || 1))}
                style={{
                  width: 110,
                  padding: 8,
                  borderRadius: 10,
                  border: "1px solid #ccc",
                }}
              />
            </div>

            <div style={{ marginTop: 8 }}>
              Entry Fee: <b>{formatUsdFromCents(stakeTickets * 100)}</b>
            </div>
          </>
        )}
      </div>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontWeight: 800 }}>市場（匿名の待機数）</div>
          <button
            onClick={reloadMarket}
            style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ccc" }}
          >
            Refresh
          </button>
        </div>

        {loadingMarket ? (
          <div style={{ marginTop: 8 }}>Loading...</div>
        ) : market.length === 0 ? (
          <div style={{ marginTop: 8 }}>待機中のデータがありません</div>
        ) : (
          <div style={{ marginTop: 8 }}>
            {(market ?? []).map((b, i) => (
              <div
                key={`stake-${b?.stakeUsd ?? "x"}-waiting-${b?.waiting ?? i}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 0",
                  borderBottom: "1px dashed #eee",
                }}
              >
                <div>
                  {b?.stakeUsd} ticket{b?.stakeUsd === 1 ? "" : "s"}
                </div>
                <div>waiting: {b?.waiting ?? 0}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {err ? (
        <div style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>
          {err}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button
          onClick={() => {
            window.location.href = "/";
          }}
          style={{ padding: 12, borderRadius: 12, border: "1px solid #ccc", flex: 1 }}
          disabled={submitting}
        >
          Cancel
        </button>

        <button
          onClick={doSubmit}
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid #000",
            fontWeight: 900,
            flex: 2,
            opacity: submitting ? 0.7 : 1,
          }}
          disabled={submitting || maxStake <= 0}
        >
          {submitting ? "Submitting..." : "Submit"}
        </button>
      </div>

      <div style={{ marginTop: 12, opacity: 0.6, fontSize: 12 }}>
        {user?.email ? `signed in: ${user.email}` : ""}
      </div>
    </div>
  );
}

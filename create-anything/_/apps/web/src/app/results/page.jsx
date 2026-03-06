"use client";

import { fmtElapsed, fmtWhenShort, fmtRemainingHm, centsToUsd, fmtUsd } from "../home/logic/format";
import { readWaitingList, writeWaitingList, dedupeWaitingList } from "../home/logic/storageWaiting";
import { readRefundedList, writeRefundedList, dedupeRefundedList } from "../home/logic/storageRefunded";
import AdminPlatformBalance from "../home/ui/AdminPlatformBalance";
import { useEffect, useMemo, useState } from "react";
import { navigate, getQueryParam } from "@/utils/navigation";
import {
  Trophy,
  Clock,
  DollarSign,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
} from "lucide-react";
import { authenticatedFetch } from "@/utils/auth";

// Vite の env があるなら使う（無ければ空でOK）
const API_BASE = "";

export default function ResultsPage() {
  const [result, setResult] = useState(null);
  const [freshBalanceCents, setFreshBalanceCents] = useState(null);

  // 初期表示：query(data) を読み取って result を作る
  useEffect(() => {
    const dataParam = getQueryParam("data");
    if (!dataParam) {
      navigate("/");
      return;
    }

    try {
      const parsed = JSON.parse(decodeURIComponent(dataParam));

      // --- ここから「不足を補完」 ---
      const metaRaw =
        typeof window !== "undefined" ? localStorage.getItem("lastSubmissionMeta") : null;
      const meta = metaRaw ? JSON.parse(metaRaw) : {};

      const myAttemptId =
        parsed?.attemptId ||
        meta?.attemptId ||
        (typeof window !== "undefined" ? localStorage.getItem("taskdash_attemptId") : null) ||
        null;

      const price =
        Number.isFinite(Number(parsed?.priceUsd)) ? Number(parsed.priceUsd) :
        Number.isFinite(Number(meta?.priceUsd)) ? Number(meta.priceUsd) :
        1;

      const timeMs =
        Number.isFinite(Number(parsed?.timeMs)) ? Number(parsed.timeMs) :
        Number.isFinite(Number(meta?.timeMs)) ? Number(meta.timeMs) :
        null;

      // settled を matched 扱いに寄せる
      const status = String(parsed?.status || "").toLowerCase();
      const normalizedStatus =
        status === "settled" ? "matched" : (parsed?.status || "matched");

      // 勝敗推定
      let resultType = parsed?.result;
      if (!resultType && myAttemptId && parsed?.winnerAttemptId) {
        resultType =
          String(myAttemptId) === String(parsed.winnerAttemptId) ? "win" : "lose";
      }

      // payout補完（cents）
      const payout =
        Number.isFinite(Number(parsed?.payout)) ? Number(parsed.payout) :
        (resultType === "win" ? Math.round(price * 0.9 * 100) : 0);

      const merged = {
        ...parsed,
        status: normalizedStatus,
        attemptId: myAttemptId ?? parsed?.attemptId,
        priceUsd: price,
        timeMs: timeMs ?? parsed?.timeMs,
        result: resultType,
        payout,
        isCorrect: typeof parsed?.isCorrect === "boolean" ? parsed.isCorrect : true,
      };

      setResult(merged);

      // ✅ Results表示後に「確定残高」を取り直す
      (async () => {
        try {
          const r = await authenticatedFetch(`/api/user/balance`);
          const b = await r.json().catch(() => null);
          if (b?.ok) {
            const cents = Number(b.balance);
            if (Number.isFinite(cents)) setFreshBalanceCents(cents);
          }
        } catch {}
      })();
    } catch (error) {
      console.error("Failed to parse result data:", error);
      navigate("/");
    }
  }, []);

  // --- 詳細無し（matched/waiting）時に result をポーリング取得 ---
  useEffect(() => {
    if (!result) return;


    const submissionId = result?.submissionId;
    if (!submissionId) return;

    const status = String(result?.status || "").toLowerCase();
    const shouldPoll = ["waiting", "queued", "pending", "matched"].includes(status);

    if (!shouldPoll) return;

    let cancelled = false;
    let t = null;

    const tick = async () => {
      try {
        const url = `/api/tasks/result?submissionId=${encodeURIComponent(submissionId)}`;
        const r = await authenticatedFetch(url);
        const j = await r.json().catch(() => null);
        if (cancelled || !j || j.ok === false) return;

        // SETTLED になったら UI を確定させる
        const jStatus = String(j.status || "").toUpperCase();
        if (jStatus === "SETTLED") {
          setResult((cur) => ({ ...(cur ?? {}), ...j, status: "matched" }));
          return;
        }

        const wait = Number(j.nextPollMs ?? 1200);
        t = setTimeout(tick, Math.max(600, Math.min(wait, 3000)));
      } catch {
        t = setTimeout(tick, 2000);
      }
    };

    tick();

    return () => {
      cancelled = true;
      if (t) clearTimeout(t);
    };
  }, [result?.submissionId, result?.status]);

  if (!result) {
    return (
      <div className="min-h-screen bg-white font-inter flex items-center justify-center">
        <div className="text-[14px] text-[#7A7A7A]">Loading results...</div>
      </div>
    );
  }

  // --- money helpers (cents) ---
  const entryFeeUsd = Number(result?.priceUsd || 1);
  const entryFeeCents = Math.round(entryFeeUsd * 100);

  const payoutCents = Number.isFinite(Number(result?.payout))
    ? Math.round(Number(result.payout))
    : null;

  const hasPayout = payoutCents !== null;
  const netCents = hasPayout ? payoutCents - entryFeeCents : null;

  const centsToUsd = (cents) => (Number(cents || 0) / 100).toFixed(2);

  const timeMs = Number.isFinite(Number(result?.timeMs)) ? Number(result.timeMs) : null;
  const hasTime = timeMs !== null;

  // newBalance が result に USD で入るケースもあり得るので、両対応
  const newBalanceUsdFromResult =
    Number.isFinite(Number(result?.newBalance)) ? Number(result.newBalance) : null;

  const shownBalanceUsd =
    freshBalanceCents !== null
      ? Number(centsToUsd(freshBalanceCents))
      : (newBalanceUsdFromResult !== null ? newBalanceUsdFromResult : null);

  const hasShownBalance = Number.isFinite(shownBalanceUsd);

  // --- 判定ロジック ---
  const hasMatch = ["matched", "settled"].includes(String(result.status || "").toLowerCase());
  const isWaiting = ["waiting", "queued", "pending"].includes(String(result.status || "").toLowerCase());
  const isTimeout = String(result.status || "").toLowerCase() === "timeout";

  const hasCorrectFlag = typeof result.isCorrect === "boolean";
  const isCorrect = hasCorrectFlag ? result.isCorrect : null;
  const resultType = typeof result.result === "string" ? result.result : null;

  return (
    <div className="min-h-screen bg-white font-inter">
      <div className="border-b border-[#EDEDED]">
        <div className="max-w-[800px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-4 border-[#2563FF] rounded-full"></div>
            <span className="text-[16px] font-semibold text-[#2B2B2B]">Task Dash</span>
          </div>
        </div>
      </div>

      <div className="max-w-[800px] mx-auto px-6 py-8">
        <div
          className={`rounded-xl p-8 mb-6 text-center ${
            hasCorrectFlag && isCorrect === false
              ? "bg-[#FEE] border border-[#FCC]"
              : isTimeout
                ? "bg-[#FEF3C7] border border-[#F59E0B]"
                : isWaiting
                  ? "bg-[#FEF9E7] border border-[#F9E79F]"
                  : resultType === "win"
                    ? "bg-[#D1FAE5] border border-[#6EE7B7]"
                    : resultType === "lose"
                      ? "bg-[#FEE2E2] border border-[#FCA5A5]"
                      : "bg-[#E0E7FF] border border-[#C7D2FE]"
          }`}
        >
          <div className="flex justify-center mb-4">
            {!isCorrect ? (
              <XCircle size={64} className="text-[#EF4444]" />
            ) : isTimeout ? (
              <RefreshCw size={64} className="text-[#F59E0B]" />
            ) : isWaiting ? (
              <Clock size={64} className="text-[#F59E0B]" />
            ) : resultType === "win" ? (
              <Trophy size={64} className="text-[#10B981]" />
            ) : resultType === "lose" ? (
              <TrendingDown size={64} className="text-[#EF4444]" />
            ) : (
              <Minus size={64} className="text-[#6366F1]" />
            )}
          </div>

          <h1
            className={`text-[28px] font-bold mb-2 ${
              hasCorrectFlag && isCorrect === false
                ? "text-[#C33]"
                : isTimeout
                  ? "text-[#D97706]"
                  : isWaiting
                    ? "text-[#D97706]"
                    : resultType === "win"
                      ? "text-[#059669]"
                      : resultType === "lose"
                        ? "text-[#DC2626]"
                        : "text-[#4F46E5]"
            }`}
          >
            {hasCorrectFlag && isCorrect === false
              ? "Incorrect Answer"
              : isTimeout
                ? "Match Timeout"
                : isWaiting
                  ? "Waiting for Opponent"
                  : resultType === "win"
                    ? "Victory!"
                    : resultType === "lose"
                      ? "Defeated"
                      : hasMatch
                        ? "Match Settled"
                        : "Result"}
          </h1>

          <p className="text-[14px] text-[#7A7A7A]">
            {hasCorrectFlag && isCorrect === false
              ? "Your answer was not in the correct descending order"
              : isTimeout
                ? "No opponent was found within 10 minutes. Your entry fee has been refunded."
                : isWaiting
                  ? "Your submission is waiting to be matched with an opponent"
                  : resultType === "win"
                    ? "You completed the task faster than your opponent"
                    : resultType === "lose"
                      ? "Your opponent was faster this time"
                      : hasMatch
                        ? "Match completed. Detailed stats are not available yet."
                        : "Result data is incomplete."}
          </p>
        </div>

        {!isTimeout && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white border border-[#F1F1F1] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Clock size={20} className="text-[#7A7A7A]" />
                <span className="text-[13px] text-[#7A7A7A]">Your Time</span>
              </div>
              <div className="text-[24px] font-semibold text-[#2B2B2B]">
                {hasTime ? `${(timeMs / 1000).toFixed(2)}s` : "—"}
              </div>
            </div>

            {hasMatch && result.opponentTime && (
              <div className="bg-white border border-[#F1F1F1] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Clock size={20} className="text-[#7A7A7A]" />
                  <span className="text-[13px] text-[#7A7A7A]">Opponent Time</span>
                </div>
                <div className="text-[24px] font-semibold text-[#2B2B2B]">
                  {Number.isFinite(result.opponentTime)
                    ? `${(result.opponentTime / 1000).toFixed(2)}s`
                    : "—"}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-white border border-[#F1F1F1] rounded-xl p-6 mb-6">
          <h2 className="text-[16px] font-semibold text-[#2B2B2B] mb-4">
            Financial Summary
          </h2>

          <div className="space-y-3">
            {isTimeout ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-[#F6F6F6]">
                  <span className="text-[13px] text-[#7A7A7A]">Original Job Fee</span>
                  <span className="text-[14px] font-semibold text-[#7A7A7A] line-through">
                    -${entryFeeUsd.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-[#F6F6F6]">
                  <span className="text-[13px] text-[#7A7A7A]">Timeout Refund</span>
                  <span className="text-[14px] font-semibold text-[#10B981]">
                    +${entryFeeUsd.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <span className="text-[14px] font-semibold text-[#2B2B2B]">Net Change</span>
                  <span className="text-[18px] font-bold text-[#7A7A7A]">$0.00</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-[#F6F6F6]">
                  <span className="text-[13px] text-[#7A7A7A]">Job Fee</span>
                  <span className="text-[14px] font-semibold text-[#EF4444]">
                    -${entryFeeUsd.toFixed(2)}
                  </span>
                </div>

                {hasMatch ? (
                  <>
                    <div className="flex items-center justify-between pb-3 border-b border-[#F6F6F6]">
                      <span className="text-[13px] text-[#7A7A7A]">Match Payout</span>
                      <span
                        className={`text-[14px] font-semibold ${
                          hasPayout && payoutCents > 0 ? "text-[#10B981]" : "text-[#7A7A7A]"
                        }`}
                      >
                        {hasPayout ? `+$${centsToUsd(payoutCents)}` : "—"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-3">
                      <span className="text-[14px] font-semibold text-[#2B2B2B]">
                        Net Profit/Loss
                      </span>
                      <div className="flex items-center gap-2">
                        {hasPayout ? (
                          netCents > 0 ? (
                            <TrendingUp size={16} className="text-[#10B981]" />
                          ) : (
                            <TrendingDown size={16} className="text-[#EF4444]" />
                          )
                        ) : null}
                        <span
                          className={`text-[18px] font-bold ${
                            hasPayout && netCents > 0 ? "text-[#10B981]" : "text-[#EF4444]"
                          }`}
                        >
                          {hasPayout ? `${netCents > 0 ? "+" : ""}$${centsToUsd(netCents)}` : "—"}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between pt-3">
                    <span className="text-[14px] font-semibold text-[#2B2B2B]">Net Loss</span>
                    <span className="text-[18px] font-bold text-[#EF4444]">
                      -${entryFeeUsd.toFixed(2)}
                    </span>
                  </div>
                )}

                {isWaiting && (
                  <div className="text-[13px] text-[#7A7A7A] pt-3 text-center">
                    Payout will be processed once an opponent is matched
                  </div>
                )}
              </>
            )}
          </div>

          {hasMatch && hasShownBalance && (
            <div className="mt-6 pt-6 border-t border-[#EDEDED]">
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-[#7A7A7A]">New Balance</span>
                <div className="flex items-center gap-2">
                  <DollarSign size={20} className="text-[#2563FF]" />
                  <span className="text-[24px] font-bold text-[#2B2B2B]">
                    {`$${shownBalanceUsd.toFixed(2)}`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => navigate("/")}
            className="flex-1 h-[56px] bg-[#2563FF] text-white text-[16px] font-semibold rounded-lg"
          >
            {hasMatch ? "Accept Another Job" : "Back to Home"}
          </button>
          <button
            onClick={() => navigate("/rules")}
            className="h-[56px] px-6 border border-[#E5E5E5] rounded-lg text-[14px] font-medium text-[#7A7A7A]"
          >
            View Rules
          </button>
        </div>
      </div>
    </div>
  );
}


"use client";

import { useEffect, useState } from "react";
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

export default function ResultsPage() {
  const [result, setResult] = useState(null);

  useEffect(() => {
    const dataParam = getQueryParam("data");
    if (!dataParam) {
      navigate("/");
      return;
    }

    try {
      const parsedData = JSON.parse(decodeURIComponent(dataParam));
      setResult(parsedData);
    } catch (error) {
      console.error("Failed to parse result data:", error);
      navigate("/");
    }
  }, []);

  if (!result) {
    return (
      <div className="min-h-screen bg-white font-inter flex items-center justify-center">
        <div className="text-[14px] text-[#7A7A7A]">Loading results...</div>
      </div>
    );
  }

  const isCorrect = result.isCorrect;
  const hasMatch = result.status === "matched";
  const isWaiting = result.status === "waiting";
  const isTimeout = result.status === "timeout";
  const resultType = result.result;

  return (
    <div className="min-h-screen bg-white font-inter">
      <div className="border-b border-[#EDEDED]">
        <div className="max-w-[800px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-4 border-[#2563FF] rounded-full"></div>
            <span className="text-[16px] font-semibold text-[#2B2B2B]">
              Task Dash
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-[800px] mx-auto px-6 py-8">
        <div
          className={`rounded-xl p-8 mb-6 text-center ${
            !isCorrect
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
              !isCorrect
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
            {!isCorrect
              ? "Incorrect Answer"
              : isTimeout
                ? "Match Timeout"
                : isWaiting
                  ? "Waiting for Opponent"
                  : resultType === "win"
                    ? "Victory!"
                    : resultType === "lose"
                      ? "Defeated"
                      : "Tie Game"}
          </h1>

          <p className="text-[14px] text-[#7A7A7A]">
            {!isCorrect
              ? "Your answer was not in the correct descending order"
              : isTimeout
                ? "No opponent was found within 10 minutes. Your entry fee has been refunded."
                : isWaiting
                  ? "Your submission is waiting to be matched with an opponent"
                  : resultType === "win"
                    ? "You completed the task faster than your opponent"
                    : resultType === "lose"
                      ? "Your opponent was faster this time"
                      : "You and your opponent finished at the same time"}
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
                {(result.timeMs / 1000).toFixed(2)}s
              </div>
            </div>

            {hasMatch && result.opponentTime && (
              <div className="bg-white border border-[#F1F1F1] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Clock size={20} className="text-[#7A7A7A]" />
                  <span className="text-[13px] text-[#7A7A7A]">
                    Opponent Time
                  </span>
                </div>
                <div className="text-[24px] font-semibold text-[#2B2B2B]">
                  {(result.opponentTime / 1000).toFixed(2)}s
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
                  <span className="text-[13px] text-[#7A7A7A]">
                    Original Job Fee
                  </span>
                  <span className="text-[14px] font-semibold text-[#7A7A7A] line-through">
                    -$1.00
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-[#F6F6F6]">
                  <span className="text-[13px] text-[#7A7A7A]">
                    Timeout Refund
                  </span>
                  <span className="text-[14px] font-semibold text-[#10B981]">
                    +$1.00
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <span className="text-[14px] font-semibold text-[#2B2B2B]">
                    Net Change
                  </span>
                  <span className="text-[18px] font-bold text-[#7A7A7A]">
                    $0.00
                  </span>
                </div>

                <div className="text-[13px] text-[#92400E] bg-[#FEF3C7] rounded-lg p-3 mt-4">
                  💡 Try again during peak hours for faster matching
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-[#F6F6F6]">
                  <span className="text-[13px] text-[#7A7A7A]">Job Fee</span>
                  <span className="text-[14px] font-semibold text-[#EF4444]">
                    -$1.00
                  </span>
                </div>

                {hasMatch && (
                  <>
                    <div className="flex items-center justify-between pb-3 border-b border-[#F6F6F6]">
                      <span className="text-[13px] text-[#7A7A7A]">
                        Match Payout
                      </span>
                      <span
                        className={`text-[14px] font-semibold ${
                          result.payout > 0
                            ? "text-[#10B981]"
                            : "text-[#7A7A7A]"
                        }`}
                      >
                        +${result.payout.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-3">
                      <span className="text-[14px] font-semibold text-[#2B2B2B]">
                        Net Profit/Loss
                      </span>
                      <div className="flex items-center gap-2">
                        {result.payout - 1 > 0 ? (
                          <TrendingUp size={16} className="text-[#10B981]" />
                        ) : (
                          <TrendingDown size={16} className="text-[#EF4444]" />
                        )}
                        <span
                          className={`text-[18px] font-bold ${
                            result.payout - 1 > 0
                              ? "text-[#10B981]"
                              : "text-[#EF4444]"
                          }`}
                        >
                          {result.payout - 1 > 0 ? "+" : ""}$
                          {(result.payout - 1).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {!hasMatch && (
                  <div className="flex items-center justify-between pt-3">
                    <span className="text-[14px] font-semibold text-[#2B2B2B]">
                      Net Loss
                    </span>
                    <span className="text-[18px] font-bold text-[#EF4444]">
                      -$1.00
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

          {hasMatch && result.newBalance !== undefined && (
            <div className="mt-6 pt-6 border-t border-[#EDEDED]">
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-[#7A7A7A]">New Balance</span>
                <div className="flex items-center gap-2">
                  <DollarSign size={20} className="text-[#2563FF]" />
                  <span className="text-[24px] font-bold text-[#2B2B2B]">
                    ${result.newBalance.toFixed(2)}
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

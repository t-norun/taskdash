"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  LogOut,
  Plus,
  ChevronRight,
  Wallet,
  Clock3,
  Trophy,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";

import { getQueryParam, navigate } from "../utils/navigation";
import { isAuthenticated, getUser, logout } from "../utils/auth";

import {
  getMode as rtGetMode,
  isDemoMode as rtIsDemoMode,
  getBalance,
  getPlatformBalance,
  listWaiting,
  checkMatch,
  recentResults,
  listForfeited,
  createPaypalOrder,
  paypalPayout,
  setMode as rtSetMode,
  addDemoBalance,
  adminPaypalPayout,
} from "../utils/runtimeData";

import { fmtElapsed, fmtWhenShort, fmtRemainingHm, centsToUsd, fmtUsd } from "./home/logic/format";
import { readWaitingList, writeWaitingList, dedupeWaitingList } from "./home/logic/storageWaiting";
import { readRefundedList, writeRefundedList, dedupeRefundedList } from "./home/logic/storageRefunded";
import AdminPlatformBalance from "./home/ui/AdminPlatformBalance";

/* =====================================================
   HARD STOP: prevent /undefined navigation
===================================================== */

const safeNavigate = (to) => {
  try {
    if (typeof to !== "string") return navigate("/");
    const s = to.trim();
    if (!s || s === "undefined" || s === "null") return navigate("/");
    if (!s.startsWith("/")) return navigate("/");
    if (s === "/undefined" || s.startsWith("/undefined?")) return navigate("/");
    return navigate(s);
  } catch {
    try {
      window.location.href = "/";
    } catch {}
  }
};

/* =====================================================
   constants
===================================================== */

const MODE_KEY = "taskdash_mode";

const LAST_SUBMIT_KEY = "lastSubmissionId";
const LEGACY_SUBMISSION_KEYS = ["taskdash_v2_submissionId", "lastSubmissionId", "taskdash_submissionId"];

const PRICE_OPTIONS = [1, 5, 10, 20, 50];

/* =====================================================
   mode helpers (URL > localStorage > runtimeData)
===================================================== */

function normalizeMode(v) {
  const s = String(v || "").toLowerCase().trim();
  if (s === "demo" || s === "d") return "demo";
  if (s === "real" || s === "prod" || s === "production" || s === "r") return "real";
  return "";
}

function getModeFromUrl() {
  const m = normalizeMode(getQueryParam("mode"));
  if (m) return m;
  const demo = getQueryParam("demo");
  if (demo === "1" || demo === "true" || demo === "yes") return "demo";
  return "";
}

function getModeFromStorage() {
  try {
    return normalizeMode(localStorage.getItem(MODE_KEY));
  } catch {
    return "";
  }
}

function getModeSafe() {
  const urlM = getModeFromUrl();
  if (urlM) return urlM;

  const lsM = getModeFromStorage();
  if (lsM) return lsM;

  try {
    const gm = typeof rtGetMode === "function" ? normalizeMode(rtGetMode()) : "";
    if (gm) return gm;
  } catch {}

  try {
    if (typeof rtIsDemoMode === "function" && rtIsDemoMode()) return "demo";
  } catch {}

  return "real";
}

function isDemoModeSafe() {
  return getModeSafe() === "demo";
}

function setModeSafe(nextMode) {
  const m = normalizeMode(nextMode) || "real";
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {}
  try {
    if (typeof rtSetMode === "function") rtSetMode(m);
  } catch {}
}

function getDemoBalanceKey() {
  return "taskdash_demo_balance_usd";
}

/* =====================================================
   time helpers
===================================================== */

function computeBackoffMs(elapsedMs) {
  const e = Math.max(0, Number(elapsedMs) || 0);
  if (e < 20_000) return 1200;
  if (e < 120_000) return 2000;
  if (e < 600_000) return 5000;
  if (e < 1_800_000) return 10_000;
  return 15_000;
}

/* =====================================================
   UI helpers
===================================================== */

function shortId(id) {
  const s = String(id || "");
  if (!s) return "";
  return s.length <= 12 ? s : `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function statusUpper(it) {
  return String((it && (it.status || it.state)) || "").toUpperCase();
}

function labelOfNotCompleted(it) {
  const st = statusUpper(it);
  if (st.includes("FORFEIT")) return "Not Completed";
  if (st.includes("EXPIRED")) return "Not Completed";
  return "Not Completed";
}

function reasonOfNotCompleted(it) {
  const st = statusUpper(it);
  if (st.includes("FORFEIT")) return "Reason: left before submitting";
  if (st.includes("EXPIRED")) return "Reason: not submitted in time";
  return "Reason: not submitted";
}

function whenOfItem(it) {
  const cand =
    (it && (it.forfeitedAt || it.expiredAt || it.updatedAt || it.submittedAt || it.createdAt)) || null;
  if (!cand) return null;
  try {
    return new Date(cand).toLocaleString();
  } catch {
    return null;
  }
}

function normalizePriceFromItem(it) {
  const stakeCents =
    it && it.stakeCents != null && Number.isFinite(Number(it.stakeCents)) ? Number(it.stakeCents) : null;

  const priceUsd =
    it && it.priceUsd != null && Number.isFinite(Number(it.priceUsd))
      ? Number(it.priceUsd)
      : stakeCents != null
      ? stakeCents / 100
      : null;

  return priceUsd;
}

function outcomeLabel(v) {
  const s = String(v || "").toLowerCase();
  if (s === "win" || s === "winner" || s === "won") return "Win";
  if (s === "lose" || s === "loss" || s === "loser" || s === "lost") return "Loss";
  if (s === "draw" || s === "tie") return "Draw";
  return "Result";
}

function outcomeTone(v) {
  const s = String(v || "").toLowerCase();
  if (s === "win" || s === "winner" || s === "won") return "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]";
  if (s === "lose" || s === "loss" || s === "loser" || s === "lost")
    return "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]";
  if (s === "draw" || s === "tie") return "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]";
  return "bg-[#F8FAFC] text-[#334155] border-[#E2E8F0]";
}

/* =====================================================
   runtime call adapters (signature drift safe)
===================================================== */

async function callPaypalPayout(amountCents, email) {
  try {
    if (typeof paypalPayout !== "function") return { ok: false, error: "paypalPayout not available" };
    if (paypalPayout.length >= 3) {
      const requestId = `wd_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      return await paypalPayout(amountCents, email, requestId);
    }
    return await paypalPayout(amountCents, email);
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

/* =====================================================
   small inline panels
===================================================== */

function EmptyState({ icon, title, text }) {
  const Icon = icon;
  return (
    <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-[#FAFAFA] px-6 py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white border border-[#E5E7EB]">
        <Icon size={20} className="text-[#9CA3AF]" />
      </div>
      <div className="text-[15px] font-semibold text-[#2B2B2B]">{title}</div>
      <div className="mt-1 text-[13px] text-[#7A7A7A]">{text}</div>
    </div>
  );
}

function SectionTitle({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <div className="text-[18px] font-semibold text-[#2B2B2B]">{title}</div>
        {subtitle ? <div className="mt-1 text-[13px] text-[#7A7A7A]">{subtitle}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

function RecentResultsPanelInline({
  recentLoading,
  recentError,
  recentMatches,
  isDemo,
  fmtWhenShort,
  fmtElapsed,
}) {
  if (recentLoading) {
    return <div className="text-[13px] text-[#7A7A7A]">Loading recent results...</div>;
  }

  if (recentError) {
    return (
      <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13px] text-[#991B1B]">
        Failed to load recent results: {String(recentError)}
      </div>
    );
  }

  if (!recentMatches || recentMatches.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title={isDemo ? "No demo results yet" : "No recent results yet"}
        text={
          isDemo
            ? "Start a practice flow and finish a task to see demo results here."
            : "Complete a task and matched results will appear here."
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {recentMatches.map((item, idx) => {
        const outcome = String(item?.outcome || item?.result || "").toLowerCase();
        const priceUsd =
          typeof item?.priceUsd === "number"
            ? item.priceUsd
            : typeof item?.stakeCents === "number"
            ? centsToUsd(item.stakeCents)
            : null;

        const payoutUsd =
          typeof item?.deltaUsd === "number"
            ? item.deltaUsd
            : typeof item?.userPayoutCents === "number"
            ? centsToUsd(item.userPayoutCents)
            : typeof item?.payout === "number"
            ? Number(item.payout)
            : null;

        const when =
          item?.revealedAt || item?.createdAt || item?.updatedAt || item?.submittedAt || item?.resolvedAt || null;

        return (
          <div
            key={String(item?.matchId || item?.submissionId || item?.attemptId || idx)}
            className="rounded-2xl border border-[#ECECEC] bg-white px-5 py-4"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-semibold ${outcomeTone(
                      outcome
                    )}`}
                  >
                    {outcomeLabel(outcome)}
                  </span>

                  {priceUsd != null ? (
                    <span className="inline-flex items-center rounded-full bg-[#F8FAFC] px-3 py-1 text-[12px] font-medium text-[#334155] border border-[#E2E8F0]">
                      Tier ${Number(priceUsd).toFixed(0)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">Evaluation</div>
                    <div className="text-[14px] font-semibold text-[#2B2B2B]">
                      {outcome === "win"
                        ? "Higher ranked"
                        : outcome === "lose"
                        ? "Lower ranked"
                        : outcome === "draw"
                        ? "Equivalent"
                        : "Processed"}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">Elapsed</div>
                    <div className="text-[14px] font-semibold text-[#2B2B2B]">
                      {item?.elapsedMs != null || item?.timeMs != null
                        ? fmtElapsed(item?.elapsedMs ?? item?.timeMs)
                        : "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">Processed</div>
                    <div className="text-[14px] font-semibold text-[#2B2B2B]">
                      {when ? fmtWhenShort(when) : "—"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#EEF2FF] bg-[#F8FAFF] px-4 py-3 md:min-w-[180px]">
                <div className="text-[11px] uppercase tracking-wide text-[#64748B]">Platform compensation</div>
                <div className="mt-1 text-[22px] font-semibold text-[#1E40AF]">
                  {payoutUsd != null ? fmtUsd(payoutUsd) : "—"}
                </div>
                <div className="mt-1 text-[11px] text-[#64748B]">
                  Based on task performance evaluation, not peer betting.
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WaitingPanelInline({
  waitingError,
  filteredWaitingList,
  waitingPriceFilter,
  setWaitingPriceFilter,
  PRICE_OPTIONS,
  waitingLoading,
  nowMs,
  fmtWhenShort,
  fmtRemainingHm,
  waitingCounts,
}) {
  const grouped = useMemo(() => {
    const map = {};
    for (const p of PRICE_OPTIONS) map[String(p)] = [];

    for (const item of filteredWaitingList || []) {
      const price = normalizePriceFromItem(item);
      const key = Number.isFinite(price) ? String(Math.round(price)) : "unknown";
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }

    return map;
  }, [filteredWaitingList, PRICE_OPTIONS]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Waiting Queue"
        subtitle="Track queued submissions by tier. Refund timing is shown per waiting item."
        right={
          <div className="text-[12px] text-[#7A7A7A]">
            {waitingLoading ? "Updating..." : "Auto-updating"}
          </div>
        }
      />

      <div className="rounded-2xl border border-[#EDEDED] bg-[#FAFAFA] p-4">
        <div className="text-[12px] font-semibold text-[#6B7280] mb-3">Filter by tier</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setWaitingPriceFilter("all")}
            className={`h-10 px-4 rounded-xl border text-[13px] font-semibold transition ${
              waitingPriceFilter === "all"
                ? "bg-[#2B2B2B] text-white border-[#2B2B2B]"
                : "bg-white text-[#2B2B2B] border-[#E5E7EB] hover:border-[#2563FF]"
            }`}
          >
            All
          </button>

          {PRICE_OPTIONS.map((price) => {
            const count = Number(waitingCounts?.[String(price)] || 0);
            return (
              <button
                key={price}
                type="button"
                onClick={() => setWaitingPriceFilter(String(price))}
                className={`h-10 px-4 rounded-xl border text-[13px] font-semibold transition ${
                  String(waitingPriceFilter) === String(price)
                    ? "bg-[#2B2B2B] text-white border-[#2B2B2B]"
                    : "bg-white text-[#2B2B2B] border-[#E5E7EB] hover:border-[#2563FF]"
                }`}
              >
                ${price}
                <span className={`ml-2 ${String(waitingPriceFilter) === String(price) ? "text-white/80" : "text-[#6B7280]"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {waitingError ? (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13px] text-[#991B1B]">
          Failed to refresh waiting queue: {String(waitingError)}
        </div>
      ) : null}

      {!filteredWaitingList || filteredWaitingList.length === 0 ? (
        <EmptyState
          icon={Clock3}
          title="No waiting submissions"
          text="Queued tasks will appear here after you submit and wait for a match."
        />
      ) : (
        <div className="space-y-5">
          {PRICE_OPTIONS.filter((price) => {
            if (waitingPriceFilter === "all") return true;
            return String(waitingPriceFilter) === String(price);
          }).map((price) => {
            const items = grouped[String(price)] || [];
            if (!items.length) {
              return (
                <div key={price} className="rounded-2xl border border-[#ECECEC] bg-white p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[16px] font-semibold text-[#2B2B2B]">Tier ${price}</div>
                    <div className="text-[12px] text-[#9CA3AF]">0 waiting</div>
                  </div>
                  <div className="text-[13px] text-[#7A7A7A]">No submissions waiting in this tier right now.</div>
                </div>
              );
            }

            return (
              <div key={price} className="rounded-2xl border border-[#ECECEC] bg-white p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[16px] font-semibold text-[#2B2B2B]">Tier ${price}</div>
                    <div className="text-[13px] text-[#7A7A7A]">
                      {items.length} waiting {items.length === 1 ? "submission" : "submissions"}
                    </div>
                  </div>
                  <div className="rounded-full bg-[#EFF6FF] border border-[#DBEAFE] px-3 py-1 text-[12px] font-semibold text-[#1D4ED8]">
                    Skill-based match queue
                  </div>
                </div>

                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const remainingMs =
                      item?.remainingMs != null
                        ? Number(item.remainingMs)
                        : item?.expiresAt
                        ? Math.max(0, new Date(item.expiresAt).getTime() - nowMs)
                        : null;

                    return (
                      <div
                        key={String(item?.submissionId || item?.attemptId || idx)}
                        className="rounded-xl border border-[#E5E7EB] bg-[#FCFCFD] p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex rounded-full bg-[#FFF7ED] border border-[#FED7AA] px-3 py-1 text-[12px] font-semibold text-[#9A3412]">
                                Waiting
                              </span>
                              <span className="inline-flex rounded-full bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1 text-[12px] font-medium text-[#334155]">
                                Submission {shortId(item?.submissionId)}
                              </span>
                            </div>

                            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                              <div>
                                <div className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">Submitted</div>
                                <div className="text-[14px] font-semibold text-[#2B2B2B]">
                                  {item?.createdAt || item?.savedAt ? fmtWhenShort(item?.createdAt || item?.savedAt) : "—"}
                                </div>
                              </div>

                              <div>
                                <div className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">Refund timing</div>
                                <div className="text-[14px] font-semibold text-[#2B2B2B]">
                                  {remainingMs != null ? fmtRemainingHm(remainingMs) : "—"}
                                </div>
                              </div>

                              <div>
                                <div className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">Status</div>
                                <div className="text-[14px] font-semibold text-[#2B2B2B]">Queued for comparison</div>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-[#F3F4F6] bg-white px-4 py-3 md:min-w-[185px]">
                            <div className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">Protection</div>
                            <div className="mt-1 text-[14px] font-semibold text-[#2B2B2B]">
                              No match → refund
                            </div>
                            <div className="mt-1 text-[11px] text-[#7A7A7A]">
                              The held participation amount is refunded if no eligible match is found in time.
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NotCompletedPanelInline({
  forfeitedLoading,
  forfeitedError,
  notCompletedItems,
  labelOfNotCompleted,
  reasonOfNotCompleted,
  whenOfItem,
}) {
  if (forfeitedLoading) {
    return <div className="text-[13px] text-[#7A7A7A]">Loading task status...</div>;
  }

  if (forfeitedError) {
    return (
      <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13px] text-[#991B1B]">
        Failed to load not completed items: {String(forfeitedError)}
      </div>
    );
  }

  if (!notCompletedItems || notCompletedItems.length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No not-completed tasks"
        text="Tasks that expire or are left before submission will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {notCompletedItems.map((item, idx) => {
        const priceUsd = normalizePriceFromItem(item);
        return (
          <div
            key={String(item?.submissionId || item?.attemptId || item?.id || idx)}
            className="rounded-2xl border border-[#ECECEC] bg-white px-5 py-4"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full border border-[#FECACA] bg-[#FEF2F2] px-3 py-1 text-[12px] font-semibold text-[#991B1B]">
                    {labelOfNotCompleted(item)}
                  </span>
                  {priceUsd != null ? (
                    <span className="inline-flex rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-1 text-[12px] font-medium text-[#334155]">
                      Tier ${Number(priceUsd).toFixed(0)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 text-[14px] font-semibold text-[#2B2B2B]">{reasonOfNotCompleted(item)}</div>
                <div className="mt-1 text-[13px] text-[#7A7A7A]">
                  {whenOfItem(item) ? `Recorded: ${whenOfItem(item)}` : "Recorded time unavailable"}
                </div>
              </div>

              <div className="rounded-xl border border-[#F3F4F6] bg-[#FAFAFA] px-4 py-3 md:min-w-[170px]">
                <div className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">Handling</div>
                <div className="mt-1 text-[14px] font-semibold text-[#2B2B2B]">Removed from active flow</div>
                <div className="mt-1 text-[11px] text-[#7A7A7A]">
                  See rules for task completion and refund handling.
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RefundedPanelInline({ refundedItems, fmtWhenShort }) {
  if (!refundedItems || refundedItems.length === 0) {
    return (
      <EmptyState
        icon={RotateCcw}
        title="No refunded items"
        text="Refunded waiting submissions will be listed here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {refundedItems.map((item, idx) => {
        const priceUsd = normalizePriceFromItem(item);
        return (
          <div
            key={String(item?.submissionId || item?.attemptId || idx)}
            className="rounded-2xl border border-[#ECECEC] bg-white px-5 py-4"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full border border-[#BBF7D0] bg-[#ECFDF5] px-3 py-1 text-[12px] font-semibold text-[#065F46]">
                    Refunded
                  </span>
                  {priceUsd != null ? (
                    <span className="inline-flex rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-1 text-[12px] font-medium text-[#334155]">
                      Tier ${Number(priceUsd).toFixed(0)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">When</div>
                    <div className="text-[14px] font-semibold text-[#2B2B2B]">
                      {item?.savedAt || item?.createdAt ? fmtWhenShort(item?.savedAt || item?.createdAt) : "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">Reason</div>
                    <div className="text-[14px] font-semibold text-[#2B2B2B]">
                      {item?.reason ? String(item.reason) : "No eligible match in time"}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">Handling</div>
                    <div className="text-[14px] font-semibold text-[#2B2B2B]">Returned to balance</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#D1FAE5] bg-[#F0FDF4] px-4 py-3 md:min-w-[185px]">
                <div className="text-[11px] uppercase tracking-wide text-[#047857]">Refund protection</div>
                <div className="mt-1 text-[14px] font-semibold text-[#065F46]">
                  Participation amount released
                </div>
                <div className="mt-1 text-[11px] text-[#047857]">
                  No match was completed within the waiting window.
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =====================================================
   component
===================================================== */

export default function HomePage() {
  const isDemo = isDemoModeSafe();

  // refs
  const pollTimerRef = useRef(null);
  const cancelledRef = useRef(false);
  const lastSigRef = useRef("");
  const waitingRef = useRef([]);
  const pollOnceRef = useRef(null);

  // auth / user
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // admin modal
  const [showAdmin, setShowAdmin] = useState(false);

  // ui state
  const [selectedPrice, setSelectedPrice] = useState(() => {
    const v = PRICE_OPTIONS && PRICE_OPTIONS[0];
    return v == null ? null : Number(v);
  });

  const [availableUsd, setAvailableUsd] = useState(0);
  const [reservedUsd, setReservedUsd] = useState(0);

  const [waitingCounts, setWaitingCounts] = useState({});
  const [waitingList, setWaitingList] = useState([]);
  const [waitingLoading, setWaitingLoading] = useState(false);
  const [waitingError, setWaitingError] = useState(null);

  const [refundedList, setRefundedList] = useState([]);

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // recent results
  const [recentMatches, setRecentMatches] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState(null);

  // add funds
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [addFundsAmount, setAddFundsAmount] = useState(10);
  const [processingPayment, setProcessingPayment] = useState(false);

  // withdraw (user)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [processingWithdraw, setProcessingWithdraw] = useState(false);

  // refund countdown tick
  const [nowMs, setNowMs] = useState(() => Date.now());

  // tabs
  const [activeTab, setActiveTab] = useState("results"); // results | waiting | notCompleted | refunded
  const [waitingPriceFilter, setWaitingPriceFilter] = useState("all");

  // admin guard
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [platformBalanceUsd, setPlatformBalanceUsd] = useState(null);

  // Not Completed
  const [forfeitedItems, setForfeitedItems] = useState([]);
  const [forfeitedError, setForfeitedError] = useState(null);
  const [forfeitedLoading, setForfeitedLoading] = useState(false);

  // Admin withdraw
  const [adminWithdrawEmail, setAdminWithdrawEmail] = useState("");
  const [adminWithdrawUsd, setAdminWithdrawUsd] = useState("1.00");
  const [adminWithdrawing, setAdminWithdrawing] = useState(false);
  const [adminWithdrawMsg, setAdminWithdrawMsg] = useState("");

  useEffect(() => {
    const urlMode = getModeFromUrl();
    if (urlMode) return;

    const ok = (() => {
      try {
        return Boolean(isAuthenticated());
      } catch {
        return false;
      }
    })();

    if (!ok) {
      setModeSafe("demo");
      try {
        window.history.replaceState(null, "", "/?mode=demo");
      } catch {}
    }
  }, []);

  useEffect(() => {
    waitingRef.current = Array.isArray(waitingList) ? waitingList : [];
  }, [waitingList]);

  useEffect(() => {
    if (isDemo && activeTab !== "results") setActiveTab("results");
  }, [isDemo, activeTab]);

  useEffect(() => {
    if (isDemo) return;
    if (!waitingList || waitingList.length === 0) return;
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [waitingList.length, isDemo]);

  useEffect(() => {
    const urlMode = getModeFromUrl();
    if (urlMode) setModeSafe(urlMode);
    else {
      const lsMode = getModeFromStorage();
      if (!lsMode) setModeSafe(getModeSafe());
    }
  }, []);

  useEffect(() => {
    const token = getQueryParam("token");
    if (token) safeNavigate(`/paypal-success?token=${encodeURIComponent(token)}`);
  }, []);

  useEffect(() => {
    if (selectedPrice != null && !PRICE_OPTIONS.includes(Number(selectedPrice))) setSelectedPrice(null);
  }, [selectedPrice]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setAdminChecked(false);
      setIsAdmin(false);
      setPlatformBalanceUsd(null);

      if (isDemo) {
        if (!mounted) return;
        setAdminChecked(true);
        return;
      }

      let authed = false;
      try {
        authed = Boolean(isAuthenticated());
      } catch {
        authed = false;
      }
      if (!authed) {
        if (!mounted) return;
        setAdminChecked(true);
        return;
      }

      try {
        const r = await getPlatformBalance();
        if (!mounted) return;
        if (r && r.ok === true) {
          setIsAdmin(true);
          setPlatformBalanceUsd(r.balanceUsd != null ? r.balanceUsd : null);
        } else {
          setIsAdmin(false);
        }
      } catch {
        if (!mounted) return;
        setIsAdmin(false);
      } finally {
        if (!mounted) return;
        setAdminChecked(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isDemo]);

  useEffect(() => {
    if (!adminChecked) return;
    if (!isAdmin) setShowAdmin(false);
  }, [adminChecked, isAdmin]);

  useEffect(() => {
    if (!showAdmin) return;
    const onKey = (e) => {
      if (e.key === "Escape") setShowAdmin(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAdmin]);

  const handleLogout = useCallback(async () => {
    try {
      try {
        localStorage.removeItem("taskdash_access_token");
      } catch {}
      await Promise.resolve(logout()).catch(() => {});
    } finally {
      window.location.href = "/";
    }
  }, []);

  const checkAuth = useCallback(async () => {
    if (isDemoModeSafe()) {
      setUser({ id: "demo", userId: "demo", level: 1 });
      return true;
    }
    try {
      const ok = await Promise.resolve(isAuthenticated()).catch(() => false);
      if (!ok) return false;

      const u = await Promise.resolve(getUser()).catch(() => null);
      if (u) setUser(u);
      return true;
    } catch (e) {
      console.error("checkAuth error:", e);
      return false;
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const b = await getBalance();
      if (!b || !b.ok) return;

      setAvailableUsd(Number(b.availableUsd || 0));
      setReservedUsd(Number(b.reservedUsd || 0));

      if (isDemoModeSafe()) {
        try {
          localStorage.setItem(getDemoBalanceKey(), String(Number(b.availableUsd || 0)));
        } catch {}
      }
    } catch (e) {
      console.error("loadData error:", e);
    }
  }, []);

  const loadWaitingCounts = useCallback(async (maybeList) => {
    if (isDemoModeSafe()) {
      setWaitingCounts({});
      return;
    }

    try {
      const list = Array.isArray(maybeList) ? maybeList : readWaitingList();
      const counts = {};
      for (const it of list) {
        const stakeCents =
          it && it.stakeCents != null && Number.isFinite(Number(it.stakeCents)) ? Number(it.stakeCents) : null;

        const priceUsd =
          it && it.priceUsd != null && Number.isFinite(Number(it.priceUsd))
            ? Number(it.priceUsd)
            : stakeCents != null
            ? stakeCents / 100
            : null;

        if (priceUsd == null) continue;
        const key = String(Math.round(priceUsd));
        counts[key] = Number(counts[key] || 0) + 1;
      }
      setWaitingCounts(counts);
    } catch (e) {
      console.error("loadWaitingCounts error:", e);
      setWaitingCounts({});
    }
  }, []);

  const loadForfeited = useCallback(async () => {
    if (isDemoModeSafe()) {
      setForfeitedItems([]);
      setForfeitedError(null);
      setForfeitedLoading(false);
      return;
    }

    setForfeitedLoading(true);
    setForfeitedError(null);

    try {
      const r = await listForfeited(50);
      if (!r || !r.ok) {
        setForfeitedItems([]);
        setForfeitedError(String((r && r.error) || "failed"));
        return;
      }
      const items = Array.isArray(r.items) ? r.items : Array.isArray(r.results) ? r.results : [];
      setForfeitedItems(items);
    } catch (e) {
      setForfeitedItems([]);
      setForfeitedError(String((e && e.message) || e));
    } finally {
      setForfeitedLoading(false);
    }
  }, []);

  const loadRecent = useCallback(async () => {
    setRecentLoading(true);
    setRecentError(null);

    const demo = isDemoModeSafe();

    try {
      const rr = await recentResults(5);
      if (!rr || !rr.ok) {
        setRecentError((rr && rr.error) || "failed");
        setRecentMatches([]);
        return;
      }

      const raw = (Array.isArray(rr.items) && rr.items) || (Array.isArray(rr.results) && rr.results) || [];

      if (!demo) {
        setRecentMatches(raw);
        return;
      }

      const items = raw.map((r, idx) => {
        const idBase = r.matchId || r.submissionId || r.attemptId || `demo_${idx}`;
        const outcome = String(r.outcome || "win").toLowerCase();
        const priceUsd =
          typeof r.priceUsd === "number"
            ? r.priceUsd
            : typeof r.stakeCents === "number"
            ? centsToUsd(r.stakeCents)
            : 1;

        return {
          ...r,
          id: String(idBase),
          outcome,
          priceUsd,
          stakeCents: typeof r.stakeCents === "number" ? r.stakeCents : Math.round(priceUsd * 100),
          createdAt: r.createdAt || null,
        };
      });

      setRecentMatches(items);
    } catch (e) {
      setRecentError(String((e && e.message) || e));
      setRecentMatches([]);
    } finally {
      setRecentLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.resolve(loadData()).catch(() => {});
    await Promise.resolve(loadRecent()).catch(() => {});
    if (!isDemoModeSafe()) {
      await Promise.resolve(loadForfeited()).catch(() => {});
      await Promise.resolve(loadWaitingCounts(readWaitingList())).catch(() => {});
    } else {
      setWaitingList([]);
      setRefundedList([]);
      setWaitingCounts({});
      setForfeitedItems([]);
    }
  }, [loadData, loadRecent, loadForfeited, loadWaitingCounts]);

  const handleStartTask = useCallback(() => {
    if (!selectedPrice) {
      alert("Please select a tier first.");
      return;
    }

    const selectedUsd = Number(selectedPrice);

    if (!isDemo && availableUsd < selectedUsd) {
      alert(`Insufficient balance. You need at least $${selectedUsd.toFixed(2)} available.`);
      return;
    }

    setShowConfirmModal(true);
  }, [selectedPrice, availableUsd, isDemo]);

  const confirmStartTask = useCallback(async () => {
    try {
      const selectedUsd = Number(selectedPrice);

      try {
        localStorage.removeItem("taskdash_v2_submissionId");
        localStorage.removeItem("lastSubmissionId");
        localStorage.removeItem(LAST_SUBMIT_KEY);
        for (const k of LEGACY_SUBMISSION_KEYS) localStorage.removeItem(k);
      } catch {}

      const qs = new URLSearchParams();
      qs.set("price", String(selectedUsd));
      if (isDemo) qs.set("mode", "demo");

      // ★ 課金しない。Task画面へ移動するだけ。
      // ★ Ready for Task を押した瞬間に task/page.jsx 側で参加確定。
      window.location.href = `/task?${qs.toString()}`;
    } catch (error) {
      alert((error && error.message) || String(error));
    } finally {
      setShowConfirmModal(false);
    }
  }, [selectedPrice, isDemo]);

  const handleAddFunds = useCallback(async () => {
    const amt = Number(addFundsAmount);
    if (!Number.isFinite(amt) || amt < 1 || amt > 500) {
      alert("Amount must be between $1 and $500");
      return;
    }

    if (isDemoModeSafe()) {
      try {
        addDemoBalance(amt);
      } catch (e) {
        console.error("addDemoBalance error:", e);
      }
      setShowAddFundsModal(false);
      await loadData();
      return;
    }

    setProcessingPayment(true);
    try {
      const order = await createPaypalOrder(amt);
      if (!order || !order.ok || !order.approveUrl) throw new Error(order.error || "Failed to create order");

      setShowAddFundsModal(false);
      window.location.assign(order.approveUrl);
    } catch (error) {
      console.error("Add funds error:", error);
      alert(`Error: ${(error && error.message) || String(error)}`);
    } finally {
      setProcessingPayment(false);
    }
  }, [addFundsAmount, loadData]);

  const handleWithdraw = useCallback(async () => {
    if (isDemoModeSafe()) {
      alert("Withdraw is disabled in demo mode.");
      return;
    }

    const amountUsd = parseFloat(String(withdrawAmount || "").trim());
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (amountUsd > Number(availableUsd || 0)) {
      alert(`Insufficient funds. You only have $${Number(availableUsd || 0).toFixed(2)} available.`);
      return;
    }

    const email = String(paypalEmail || "").trim();
    if (!email || !email.includes("@")) {
      alert("Please enter a valid PayPal email address");
      return;
    }

    setProcessingWithdraw(true);
    try {
      const amountCents = Math.round(amountUsd * 100);
      const out = await callPaypalPayout(amountCents, email);

      if (!out || !out.ok) throw new Error((out && out.error) || "Failed to process withdrawal");

      alert(`Withdrawal request submitted! Status: ${out.status || "ok"}`);
      setShowWithdrawModal(false);
      setWithdrawAmount("");
      setPaypalEmail("");

      await loadData();
    } catch (error) {
      console.error("Withdraw error:", error);
      alert((error && error.message) || String(error));
    } finally {
      setProcessingWithdraw(false);
    }
  }, [withdrawAmount, availableUsd, paypalEmail, loadData]);

  const handleAdminWithdraw = useCallback(async () => {
    setAdminWithdrawMsg("");

    if (isDemoModeSafe()) {
      setAdminWithdrawMsg("Admin withdraw is disabled in demo mode.");
      return;
    }

    const email = String(adminWithdrawEmail || "").trim();
    if (!email || !email.includes("@")) {
      setAdminWithdrawMsg("Enter a valid PayPal email.");
      return;
    }

    const usd = Number(String(adminWithdrawUsd || "").replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(usd) || usd <= 0) {
      setAdminWithdrawMsg("Enter a valid amount in USD.");
      return;
    }

    const amountCents = Math.round(usd * 100);
    if (amountCents < 100) {
      setAdminWithdrawMsg("Minimum withdraw is $1.00");
      return;
    }

    setAdminWithdrawing(true);
    try {
      const r = await adminPaypalPayout(amountCents, email);

      if (!r || !r.ok) {
        if (r && r.error === "INSUFFICIENT_PLATFORM_BALANCE") {
          const cur = Number(r.balanceCents || 0) / 100;
          setAdminWithdrawMsg(`Insufficient platform balance. Current: $${cur.toFixed(2)}`);
        } else if (r && r.error === "FORBIDDEN") {
          setAdminWithdrawMsg("Forbidden (admin only).");
        } else if (r && r.error === "PAYOUT_AMOUNT_TOO_SMALL") {
          const min = Number(r.minCents || 100) / 100;
          setAdminWithdrawMsg(`Amount too small. Min: $${min.toFixed(2)}`);
        } else if (r && r.error) {
          setAdminWithdrawMsg(`Withdraw failed: ${String(r.error)}`);
        } else {
          setAdminWithdrawMsg("Withdraw failed: UNKNOWN_ERROR");
        }
        return;
      }

      setAdminWithdrawMsg(
        `✅ Payout requested. Batch: ${r.payoutBatchId || "unknown"} (ref: ${r.referenceId || "n/a"})`
      );

      try {
        const pb = await getPlatformBalance();
        if (pb && pb.ok) setPlatformBalanceUsd(pb.balanceUsd != null ? pb.balanceUsd : null);
      } catch {}
    } catch (e) {
      setAdminWithdrawMsg(`Withdraw error: ${String((e && e.message) || e)}`);
    } finally {
      setAdminWithdrawing(false);
    }
  }, [adminWithdrawEmail, adminWithdrawUsd]);

  useEffect(() => {
    let alive = true;

    (async () => {
      const ok = await checkAuth();
      if (!ok) {
        if (!alive) return;
        setLoading(false);
        const wantsReal = getModeSafe() === "real";
        if (wantsReal) safeNavigate("/login?redirect=/");
        return;
      }
      if (!alive) return;

      if (!isDemoModeSafe()) {
        try {
          const w = readWaitingList();
          setWaitingList(w);
          loadWaitingCounts(w);
        } catch {}

        try {
          setRefundedList(readRefundedList());
        } catch {}
      } else {
        setWaitingList([]);
        setRefundedList([]);
        setWaitingCounts({});
      }

      await refreshAll();
      if (alive) setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [checkAuth, refreshAll, loadWaitingCounts]);

  useEffect(() => {
    const run = () => {
      loadRecent();
      loadData();

      if (!isDemoModeSafe()) {
        loadForfeited();
        try {
          const w = readWaitingList();
          setWaitingList(w);
          loadWaitingCounts(w);
        } catch {}
        try {
          setRefundedList(readRefundedList());
        } catch {}
      }
    };

    run();

    const onFocus = () => run();
    const onVis = () => {
      if (document.visibilityState === "visible") run();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onFocus);
    };
  }, [loadRecent, loadData, loadForfeited, loadWaitingCounts]);

  const filteredWaitingList = useMemo(() => {
    const list = waitingList || [];
    if (waitingPriceFilter === "all") return list;

    const p = Number(waitingPriceFilter);
    if (!Number.isFinite(p) || p <= 0) return list;

    return list.filter((x) => {
      const stakeCents =
        x && x.stakeCents != null && Number.isFinite(Number(x.stakeCents)) ? Number(x.stakeCents) : null;

      const price =
        x && x.priceUsd != null && Number.isFinite(Number(x.priceUsd))
          ? Number(x.priceUsd)
          : stakeCents != null
          ? stakeCents / 100
          : null;

      if (price == null) return true;
      return Math.round(price * 100) === Math.round(p * 100);
    });
  }, [waitingList, waitingPriceFilter]);

  const notCompletedItems = useMemo(
    () => (Array.isArray(forfeitedItems) ? forfeitedItems : []),
    [forfeitedItems]
  );
  const refundedItems = useMemo(() => (Array.isArray(refundedList) ? refundedList : []), [refundedList]);

  const totalWaitingCount = useMemo(() => (Array.isArray(waitingList) ? waitingList.length : 0), [waitingList]);

  const selectedTierWaiting = useMemo(() => {
    if (selectedPrice == null) return 0;
    return Number(waitingCounts[String(selectedPrice)] || 0);
  }, [selectedPrice, waitingCounts]);

  const selectedTierCanStart = useMemo(() => {
    if (selectedPrice == null) return false;
    if (isDemo) return true;
    return availableUsd >= Number(selectedPrice);
  }, [selectedPrice, isDemo, availableUsd]);

  /* =====================================================
     Waiting polling (stable)
  ===================================================== */

  const stopPolling = useCallback(() => {
    const t = pollTimerRef.current;
    if (t) clearTimeout(t);
    pollTimerRef.current = null;
  }, []);

  const schedulePolling = useCallback(
    (ms) => {
      stopPolling();
      pollTimerRef.current = setTimeout(() => {
        const fn = pollOnceRef.current;
        if (typeof fn === "function") fn();
      }, Math.max(300, Number(ms) || 1500));
    },
    [stopPolling]
  );

  const sigOf = useCallback((list) => {
    return JSON.stringify(
      (list || []).map((x) => ({
        submissionId: String((x && x.submissionId) || ""),
        status: String((x && x.status) || ""),
        stakeCents: x ? x.stakeCents : null,
        priceUsd: x ? x.priceUsd : null,
        expiresAt: x ? x.expiresAt : null,
        remainingMs: x ? x.remainingMs : null,
      }))
    );
  }, []);

  const moveToRefunded = useCallback(
    (w, checkMatchPayload) => {
      const sid = String((w && w.submissionId) || "");
      if (!sid) return;

      const stakeCents =
        w && w.stakeCents != null && Number.isFinite(Number(w.stakeCents)) ? Number(w.stakeCents) : null;

      const priceUsd =
        w && w.priceUsd != null && Number.isFinite(Number(w.priceUsd))
          ? Number(w.priceUsd)
          : stakeCents != null
          ? stakeCents / 100
          : null;

      const item = {
        submissionId: sid,
        attemptId: String((checkMatchPayload && checkMatchPayload.attemptId) ?? sid),
        createdAt: (w && w.createdAt) ?? null,
        savedAt: Date.now(),
        stakeCents: stakeCents ?? null,
        priceUsd: priceUsd ?? null,
        reason: String((checkMatchPayload && checkMatchPayload.reason) || "no match in time"),
        status: "REFUNDED",
      };

      setRefundedList((prev) => {
        const next = dedupeRefundedList([item, ...((Array.isArray(prev) && prev) || [])]);
        writeRefundedList(next);
        return next;
      });

      setWaitingList((prev) => {
        const next = ((Array.isArray(prev) && prev) || []).filter(
          (x) => String((x && x.submissionId) || "") !== sid
        );
        writeWaitingList(next);
        return next;
      });

      try {
        const nextWaiting = readWaitingList().filter((x) => String((x && x.submissionId) || "") !== sid);
        loadWaitingCounts(nextWaiting);
      } catch {}
    },
    [loadWaitingCounts]
  );

  const pollOnce = useCallback(async () => {
    if (cancelledRef.current) return;

    if (isDemoModeSafe()) {
      stopPolling();
      return;
    }

    if (!waitingRef.current || waitingRef.current.length === 0) {
      stopPolling();
      return;
    }

    setWaitingLoading(true);
    setWaitingError(null);

    try {
      const limit = 20;

      const res = await listWaiting(limit);
      if (!res || !res.ok) throw new Error((res && res.error) || "failed");

      const rawList = Array.isArray(res.items) ? res.items : [];
      const nowEpochMs = Date.now();

      const normalized = dedupeWaitingList(rawList).map((x) => {
        const stakeCents =
          x && x.stakeCents != null && Number.isFinite(Number(x.stakeCents))
            ? Number(x.stakeCents)
            : x && x.stake != null && Number.isFinite(Number(x.stake))
            ? Number(x.stake)
            : null;

        const priceUsd =
          x && x.priceUsd != null && Number.isFinite(Number(x.priceUsd))
            ? Number(x.priceUsd)
            : x && x.price != null && Number.isFinite(Number(x.price))
            ? Number(x.price)
            : stakeCents != null
            ? stakeCents / 100
            : null;

        const savedAtRaw = x ? x.savedAt ?? x.createdAt ?? null : null;
        const savedAt =
          savedAtRaw != null && Number.isFinite(Number(savedAtRaw))
            ? Number(savedAtRaw)
            : x && x.createdAt
            ? new Date(x.createdAt).getTime()
            : nowEpochMs;

        let expiresAtMs = null;
        if (x && x.expiresAt) {
          const t = new Date(x.expiresAt).getTime();
          if (Number.isFinite(t)) expiresAtMs = t;
        }
        const remainingMsRaw = x && x.remainingMs != null ? Number(x.remainingMs) : null;
        if (expiresAtMs == null && Number.isFinite(remainingMsRaw)) {
          const ms = Number(remainingMsRaw);
          if (Number.isFinite(ms)) expiresAtMs = nowEpochMs + Math.max(0, ms);
        }

        const expiresAt = expiresAtMs != null ? new Date(expiresAtMs).toISOString() : null;
        const remainingMs = expiresAtMs != null ? Math.max(0, expiresAtMs - nowEpochMs) : null;

        const sid = String((x && (x.submissionId || x.id || x.attemptId)) || "");

        return {
          ...x,
          submissionId: sid,
          stakeCents,
          priceUsd,
          savedAt,
          status: (x && x.status) ?? "WAITING",
          expiresAt,
          remainingMs,
          _fetchedAtMs: nowEpochMs,
        };
      });

      const sig = sigOf(normalized);
      if (sig !== lastSigRef.current) {
        lastSigRef.current = sig;
        setWaitingList(normalized);
        writeWaitingList(normalized);
        loadWaitingCounts(normalized);
      }

      for (const w of normalized) {
        if (cancelledRef.current) return;
        const sid = String((w && w.submissionId) || "");
        if (!sid) continue;

        const j = await checkMatch(sid);

        if (j && j.matchId) {
          const mid = String(j.matchId);
          try {
            localStorage.setItem("lastMatchId", mid);
          } catch {}

          const next = normalized.filter((x) => String((x && x.submissionId) || "") !== sid);
          setWaitingList(next);
          writeWaitingList(next);
          loadWaitingCounts(next);

          window.location.href = `/match?matchId=${encodeURIComponent(mid)}`;
          return;
        }

        const st = String((j && j.status) || "").toLowerCase();
        const stc = String((j && j.statusCompat) || "").toLowerCase();
        const refunded = !!(j && j.refunded);

        if (refunded || st === "cancelled" || stc === "cancelled") {
          moveToRefunded(w, j);
        }
      }

      const oldest = normalized && normalized.length ? normalized[normalized.length - 1].savedAt : nowEpochMs;
      const elapsed = nowEpochMs - Number(oldest || nowEpochMs);
      schedulePolling(computeBackoffMs(elapsed));
    } catch (e) {
      setWaitingError((e && e.message) || String(e));
      const local = readWaitingList();
      setWaitingList(local);
      loadWaitingCounts(local);
      schedulePolling(2000);
    } finally {
      setWaitingLoading(false);
    }
  }, [schedulePolling, sigOf, stopPolling, moveToRefunded, loadWaitingCounts]);

  useEffect(() => {
    pollOnceRef.current = pollOnce;
  }, [pollOnce]);

  useEffect(() => {
    cancelledRef.current = false;

    if (isDemoModeSafe()) {
      stopPolling();
      setWaitingList([]);
      setWaitingCounts({});
      setRefundedList([]);
      return () => {
        cancelledRef.current = true;
        stopPolling();
      };
    }

    const local = readWaitingList();
    if (local.length > 0) {
      setWaitingList(local);
      loadWaitingCounts(local);
      schedulePolling(800);
    } else {
      stopPolling();
      setWaitingCounts({});
    }

    try {
      setRefundedList(readRefundedList());
    } catch {}

    return () => {
      cancelledRef.current = true;
      stopPolling();
    };
  }, [schedulePolling, stopPolling, loadWaitingCounts]);

  /* =====================================================
     render
  ===================================================== */

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-white font-inter flex items-center justify-center">
        <div className="text-[14px] text-[#7A7A7A]">Loading...</div>
      </div>
    );
  }

  if (!isDemo && !user) {
    return (
      <div className="min-h-screen bg-white font-inter flex items-center justify-center">
        <div className="text-[14px] text-[#7A7A7A]">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-inter">
      <div className="border-b border-[#EDEDED]">
        <div className="max-w-[960px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-4 border-[#2563FF] rounded-full" />
            <span className="text-[16px] font-semibold text-[#2B2B2B]">Task Dash{isDemo ? " (Demo)" : ""}</span>
          </div>

          <div className="flex items-center gap-4">
            {isDemo ? (
              <button
                onClick={() => {
                  const ok = (() => {
                    try {
                      return Boolean(isAuthenticated());
                    } catch {
                      return false;
                    }
                  })();

                  if (!ok) {
                    safeNavigate("/login?redirect=/?mode=real");
                    return;
                  }

                  setModeSafe("real");
                  window.location.href = "/?mode=real";
                }}
                className="text-[12px] px-3 py-1 rounded border border-[#2563FF] text-[#2563FF] hover:bg-[#2563FF] hover:text-white transition"
              >
                Switch to Real
              </button>
            ) : (
              <button
                onClick={() => {
                  setModeSafe("demo");
                  window.location.href = "/?mode=demo";
                }}
                className="text-[12px] px-3 py-1 rounded border border-[#2563FF] text-[#2563FF] hover:bg-[#2563FF] hover:text-white transition"
              >
                Demo
              </button>
            )}

            {!isDemo && adminChecked && isAdmin ? (
              <button
                type="button"
                onClick={() => setShowAdmin(true)}
                className="text-[13px] text-[#7A7A7A] hover:text-[#2B2B2B]"
              >
                Admin{platformBalanceUsd != null ? ` ($${Number(platformBalanceUsd).toFixed(2)})` : ""}
              </button>
            ) : null}

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-[13px] text-[#7A7A7A] hover:text-[#2B2B2B]"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[960px] mx-auto px-6 py-8">
        {/* Hero / Wallet / Start */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-6 mb-6">
          <div className="bg-white border border-[#F1F1F1] rounded-2xl p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center rounded-full bg-[#EFF6FF] border border-[#DBEAFE] px-3 py-1 text-[12px] font-semibold text-[#1D4ED8]">
                  Skill-based task platform
                </div>
                <h1 className="mt-4 text-[28px] leading-[1.15] font-semibold text-[#2B2B2B]">
                  Practice first, then enter the real task when you are ready.
                </h1>
                <p className="mt-3 text-[14px] leading-6 text-[#6B7280] max-w-[640px]">
                  Choose a tier, open the task, try the practice board, and only then confirm participation with
                  <strong> Ready for Task</strong>. Your participation amount is not reserved at Start.
                </p>
              </div>

              <div className="hidden md:flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8FAFF] border border-[#E0E7FF]">
                <Trophy size={24} className="text-[#2563FF]" />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4">
                <div className="text-[12px] font-semibold text-[#6B7280]">Step 1</div>
                <div className="mt-1 text-[14px] font-semibold text-[#2B2B2B]">Select a tier</div>
                <div className="mt-1 text-[12px] text-[#7A7A7A]">Pick your task level and see queue activity.</div>
              </div>

              <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4">
                <div className="text-[12px] font-semibold text-[#6B7280]">Step 2</div>
                <div className="mt-1 text-[14px] font-semibold text-[#2B2B2B]">Practice for free</div>
                <div className="mt-1 text-[12px] text-[#7A7A7A]">
                  Start opens the practice screen. No charge happens there.
                </div>
              </div>

              <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4">
                <div className="text-[12px] font-semibold text-[#6B7280]">Step 3</div>
                <div className="mt-1 text-[14px] font-semibold text-[#2B2B2B]">Ready confirms entry</div>
                <div className="mt-1 text-[12px] text-[#7A7A7A]">
                  The participation amount is reserved only when you press Ready for Task.
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#F1F1F1] rounded-2xl p-7">
            <div className="flex items-center gap-2">
              <Wallet size={18} className="text-[#2563FF]" />
              <div className="text-[13px] font-semibold text-[#6B7280]">Wallet</div>
            </div>

            <div className="mt-4">
              <div className="text-[12px] text-[#7A7A7A]">Available Balance</div>
              <div className="mt-1 text-[34px] leading-none font-semibold text-[#2B2B2B]">{fmtUsd(availableUsd)}</div>
              {reservedUsd > 0 ? (
                <div className="mt-2 text-[12px] text-[#D97706]">
                  {fmtUsd(reservedUsd)} currently reserved
                </div>
              ) : (
                <div className="mt-2 text-[12px] text-[#7A7A7A]">
                  {isDemo ? "Demo funds only." : "Available for future task participation."}
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowAddFundsModal(true)}
                className="h-[46px] flex items-center justify-center gap-2 bg-[#10B981] text-white text-[13px] font-semibold rounded-xl hover:bg-[#059669]"
              >
                <Plus size={16} />
                {isDemo ? "Add Demo Funds" : "Add Funds"}
              </button>

              <button
                onClick={() => setShowWithdrawModal(true)}
                className="h-[46px] flex items-center justify-center gap-2 bg-white border border-[#E5E7EB] text-[#2B2B2B] text-[13px] font-semibold rounded-xl hover:border-[#2563FF]"
              >
                Withdraw
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4">
              <div className="text-[12px] font-semibold text-[#6B7280]">Important</div>
              <div className="mt-1 text-[12px] leading-5 text-[#7A7A7A]">
                Task Dash is a performance-evaluated platform. Compensation is determined by completed work quality
                and timing, not by user-to-user wagering.
              </div>
            </div>
          </div>
        </div>

        {/* Tier selection / start */}
        <div className="bg-white border border-[#F1F1F1] rounded-2xl p-7 mb-6">
          <SectionTitle
            title="Choose a Task Tier"
            subtitle="Queue activity is shown per tier. Start opens practice first."
            right={
              !isDemo ? (
                <div className="text-[12px] text-[#7A7A7A]">
                  Total waiting: <span className="font-semibold text-[#2B2B2B]">{totalWaitingCount}</span>
                </div>
              ) : (
                <div className="text-[12px] text-[#7A7A7A]">Demo mode</div>
              )
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            {PRICE_OPTIONS.map((price) => {
              const disabled = !isDemo && availableUsd < price;
              const selected = Number(selectedPrice) === Number(price);
              const waiting = Number(waitingCounts[String(price)] || 0);

              return (
                <button
                  key={price}
                  type="button"
                  onClick={() => setSelectedPrice(price)}
                  disabled={disabled}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    selected
                      ? "border-[#2563FF] bg-[#F8FAFF] shadow-[0_10px_24px_rgba(37,99,255,0.10)]"
                      : disabled
                      ? "border-[#E5E7EB] bg-[#F9FAFB] opacity-60 cursor-not-allowed"
                      : "border-[#E5E7EB] bg-white hover:border-[#2563FF]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[22px] font-semibold text-[#2B2B2B]">${price}</div>
                    {selected ? (
                      <div className="rounded-full bg-[#2563FF] px-2.5 py-1 text-[11px] font-semibold text-white">
                        Selected
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 text-[12px] text-[#7A7A7A]">
                    {disabled ? "Need more balance" : "Open task practice"}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-[12px] font-semibold text-[#6B7280]">Queue</div>
                    <div className="rounded-full border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-1 text-[12px] font-semibold text-[#2B2B2B]">
                      {waiting}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-center">
            <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] p-4">
              <div className="text-[12px] font-semibold text-[#6B7280]">Selected flow</div>
              <div className="mt-2 text-[14px] text-[#2B2B2B]">
                <strong>Start Task</strong> → Practice board → <strong>Ready for Task</strong> → participation amount
                reserved → real timed task
              </div>
              <div className="mt-2 text-[12px] text-[#7A7A7A]">
                {selectedPrice != null
                  ? `Selected tier: $${Number(selectedPrice).toFixed(2)}`
                  : "Select a tier to continue."}
                {!isDemo && selectedPrice != null
                  ? `  •  Current queue in this tier: ${selectedTierWaiting}`
                  : ""}
              </div>
            </div>

            <button
              onClick={handleStartTask}
              disabled={!selectedTierCanStart}
              className="h-[56px] px-6 rounded-2xl bg-[#2563FF] text-white text-[16px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1E40AF] flex items-center justify-center gap-2"
            >
              {selectedPrice == null
                ? "Select Tier First"
                : `Start Task Practice ($${Number(selectedPrice).toFixed(2)})`}
              <ChevronRight size={18} />
            </button>
          </div>

          {!isDemo && selectedPrice != null && availableUsd < Number(selectedPrice) ? (
            <p className="text-[12px] text-[#C33] mt-3">
              Insufficient balance for this tier. Add funds or select a lower tier.
            </p>
          ) : null}
        </div>

        {/* Activity / tabs */}
        <div className="bg-white border border-[#F1F1F1] rounded-2xl p-6 mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex flex-wrap rounded-xl border border-[#E7E7E7] bg-white p-1 shadow-[0_6px_16px_rgba(0,0,0,0.06)]">
              <button
                type="button"
                onClick={() => setActiveTab("results")}
                className={[
                  "px-5 py-3 rounded-lg text-[14px] font-semibold transition",
                  activeTab === "results"
                    ? "bg-[#2B2B2B] text-white shadow-[0_10px_18px_rgba(0,0,0,0.16)]"
                    : "text-[#7A7A7A] hover:text-[#2B2B2B]",
                ].join(" ")}
              >
                Recent Results
              </button>

              {!isDemo ? (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab("waiting")}
                    className={[
                      "px-5 py-3 rounded-lg text-[14px] font-semibold transition",
                      activeTab === "waiting"
                        ? "bg-[#2B2B2B] text-white shadow-[0_10px_18px_rgba(0,0,0,0.16)]"
                        : "text-[#7A7A7A] hover:text-[#2B2B2B]",
                    ].join(" ")}
                  >
                    Waiting{totalWaitingCount ? ` (${totalWaitingCount})` : ""}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("notCompleted")}
                    className={[
                      "px-5 py-3 rounded-lg text-[14px] font-semibold transition",
                      activeTab === "notCompleted"
                        ? "bg-[#2B2B2B] text-white shadow-[0_10px_18px_rgba(0,0,0,0.16)]"
                        : "text-[#7A7A7A] hover:text-[#2B2B2B]",
                    ].join(" ")}
                  >
                    Not Completed
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("refunded")}
                    className={[
                      "px-5 py-3 rounded-lg text-[14px] font-semibold transition",
                      activeTab === "refunded"
                        ? "bg-[#2B2B2B] text-white shadow-[0_10px_18px_rgba(0,0,0,0.16)]"
                        : "text-[#7A7A7A] hover:text-[#2B2B2B]",
                    ].join(" ")}
                  >
                    Refunded{refundedItems && refundedItems.length ? ` (${refundedItems.length})` : ""}
                  </button>
                </>
              ) : null}
            </div>

            {!isDemo ? (
              <div className="text-[12px] text-[#7A7A7A]">
                {activeTab === "waiting"
                  ? waitingLoading
                    ? "Updating queue..."
                    : "Queue auto-updates"
                  : activeTab === "notCompleted"
                  ? forfeitedLoading
                    ? "Loading task status..."
                    : ""
                  : ""}
              </div>
            ) : (
              <div className="text-[12px] text-[#7A7A7A]">Demo mode</div>
            )}
          </div>

          <div className="mt-6">
            {activeTab === "results" ? (
              <RecentResultsPanelInline
                recentLoading={recentLoading}
                recentError={recentError}
                recentMatches={recentMatches}
                isDemo={isDemo}
                fmtWhenShort={fmtWhenShort}
                fmtElapsed={fmtElapsed}
              />
            ) : null}

            {!isDemo && activeTab === "waiting" ? (
              <WaitingPanelInline
                waitingError={waitingError}
                filteredWaitingList={filteredWaitingList}
                waitingPriceFilter={waitingPriceFilter}
                setWaitingPriceFilter={setWaitingPriceFilter}
                PRICE_OPTIONS={PRICE_OPTIONS}
                waitingLoading={waitingLoading}
                nowMs={nowMs}
                fmtWhenShort={fmtWhenShort}
                fmtRemainingHm={fmtRemainingHm}
                waitingCounts={waitingCounts}
              />
            ) : null}

            {!isDemo && activeTab === "notCompleted" ? (
              <NotCompletedPanelInline
                forfeitedLoading={forfeitedLoading}
                forfeitedError={forfeitedError}
                notCompletedItems={notCompletedItems}
                labelOfNotCompleted={labelOfNotCompleted}
                reasonOfNotCompleted={reasonOfNotCompleted}
                whenOfItem={whenOfItem}
              />
            ) : null}

            {!isDemo && activeTab === "refunded" ? (
              <RefundedPanelInline refundedItems={refundedItems} fmtWhenShort={fmtWhenShort} />
            ) : null}
          </div>
        </div>

        <a
          href="/rules"
          className="w-full h-[52px] border border-[#E5E5E5] rounded-2xl text-[14px] font-medium text-[#7A7A7A] flex items-center justify-center gap-2 hover:border-[#2563FF] hover:text-[#2563FF]"
        >
          <BookOpen size={16} />
          How Task Dash Works
        </a>
      </div>

      {/* Admin Modal */}
      {showAdmin && adminChecked && isAdmin ? (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAdmin(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-[560px] bg-white rounded-2xl border border-[#F1F1F1] shadow-[0_20px_60px_rgba(0,0,0,0.20)] p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[12px] text-[#7A7A7A] font-semibold">Admin</div>
                  <div className="mt-1 text-[18px] font-bold text-[#2B2B2B]">Platform Wallet</div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdmin(false)}
                  className="shrink-0 text-[12px] px-3 py-1 rounded border border-[#E7E7E7] text-[#2B2B2B] hover:opacity-80"
                >
                  Close
                </button>
              </div>

              <div className="mt-5">
                <AdminPlatformBalance getPlatformBalance={getPlatformBalance} />

                <div className="mt-5 border-t border-[#F1F1F1] pt-5">
                  <div className="text-[12px] text-[#7A7A7A] font-semibold">PayPal Withdraw (Admin)</div>
                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <div>
                      <div className="text-[12px] text-[#2B2B2B] font-semibold">PayPal Email</div>
                      <input
                        value={adminWithdrawEmail}
                        onChange={(e) => setAdminWithdrawEmail(e.target.value)}
                        placeholder="example@paypal.com"
                        className="mt-1 w-full h-10 px-3 rounded-lg border border-[#E7E7E7] text-[14px] outline-none"
                      />
                    </div>
                    <div>
                      <div className="text-[12px] text-[#2B2B2B] font-semibold">Amount (USD)</div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-10 px-3 rounded-lg border border-[#E7E7E7] bg-[#FAFAFA] flex items-center text-[14px] text-[#2B2B2B]">
                          $
                        </div>
                        <input
                          value={adminWithdrawUsd}
                          onChange={(e) => setAdminWithdrawUsd(e.target.value)}
                          inputMode="decimal"
                          placeholder="1.00"
                          className="w-full h-10 px-3 rounded-lg border border-[#E7E7E7] text-[14px] outline-none"
                        />
                      </div>
                      <div className="mt-1 text-[12px] text-[#7A7A7A]">Min: $1.00</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAdminWithdraw}
                        disabled={adminWithdrawing}
                        className="h-10 px-4 rounded-lg bg-[#2B2B2B] text-white text-[13px] font-semibold disabled:opacity-50"
                      >
                        {adminWithdrawing ? "Withdrawing..." : "Withdraw"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdminWithdrawMsg("");
                          setAdminWithdrawEmail("");
                          setAdminWithdrawUsd("1.00");
                        }}
                        disabled={adminWithdrawing}
                        className="h-10 px-4 rounded-lg border border-[#E7E7E7] text-[#2B2B2B] text-[13px] font-semibold disabled:opacity-50"
                      >
                        Clear
                      </button>
                    </div>
                    {adminWithdrawMsg ? (
                      <div className="text-[12px] text-[#2B2B2B] bg-[#FAFAFA] border border-[#E7E7E7] rounded-lg p-3">
                        {adminWithdrawMsg}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Add Funds Modal */}
      {showAddFundsModal ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-[400px] w-full">
            <h3 className="text-[18px] font-semibold text-[#2B2B2B] mb-4">
              {isDemo ? "Add Demo Credits" : "Add Funds via PayPal"}
            </h3>
            <p className="text-[13px] text-[#7A7A7A] mb-4">
              {isDemo ? "This adds fake money locally (no payment)." : "You'll be redirected to PayPal to complete the payment."}
            </p>

            <div className="mb-6">
              <label className="text-[13px] font-medium text-[#2B2B2B] mb-2 block">Amount (USD)</label>
              <input
                type="number"
                min="1"
                max="500"
                value={addFundsAmount}
                onChange={(e) => setAddFundsAmount(parseFloat(e.target.value) || 1)}
                className="w-full h-[48px] px-4 border-2 border-[#E5E5E5] rounded-xl text-[16px] focus:border-[#2563FF] focus:outline-none"
              />
              <p className="text-[11px] text-[#9B9B9B] mt-1">Minimum: $1 | Maximum: $500</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAddFundsModal(false);
                  setAddFundsAmount(10);
                }}
                disabled={processingPayment}
                className="flex-1 h-[48px] border border-[#E5E5E5] rounded-xl text-[14px] font-medium text-[#7A7A7A] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFunds}
                disabled={processingPayment}
                className="flex-1 h-[48px] bg-[#2563FF] text-white text-[14px] font-semibold rounded-xl disabled:opacity-50"
              >
                {processingPayment ? "Processing..." : `Add $${Number(addFundsAmount).toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Withdraw Modal */}
      {showWithdrawModal ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-[400px] w-full">
            <h3 className="text-[18px] font-semibold text-[#2B2B2B] mb-4">Withdraw to PayPal</h3>
            <p className="text-[13px] text-[#7A7A7A] mb-4">
              Available balance: <strong>{fmtUsd(availableUsd)}</strong>
            </p>

            <div className="mb-4">
              <label className="text-[13px] font-medium text-[#2B2B2B] mb-2 block">Amount (USD)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full h-[48px] px-4 border-2 border-[#E5E5E5] rounded-xl text-[16px] focus:border-[#2563FF] focus:outline-none"
                placeholder="Enter amount"
              />
            </div>

            <div className="mb-6">
              <label className="text-[13px] font-medium text-[#2B2B2B] mb-2 block">PayPal Email</label>
              <input
                type="email"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                className="w-full h-[48px] px-4 border-2 border-[#E5E5E5] rounded-xl text-[16px] focus:border-[#2563FF] focus:outline-none"
                placeholder="your@email.com"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawAmount("");
                  setPaypalEmail("");
                }}
                disabled={processingWithdraw}
                className="flex-1 h-[48px] border border-[#E5E5E5] rounded-xl text-[14px] font-medium text-[#7A7A7A] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                disabled={processingWithdraw}
                className="flex-1 h-[48px] bg-[#2563FF] text-white text-[14px] font-semibold rounded-xl disabled:opacity-50"
              >
                {processingWithdraw ? "Processing..." : "Withdraw"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirm Modal */}
      {showConfirmModal ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-[440px] w-full">
            <h3 className="text-[18px] font-semibold text-[#2B2B2B] mb-4">Open task practice?</h3>

            <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4 mb-5">
              <div className="text-[14px] text-[#2B2B2B]">
                Selected tier: <strong>${Number(selectedPrice || 0).toFixed(2)}</strong>
              </div>
              <div className="mt-2 text-[13px] text-[#6B7280] leading-6">
                Start Task only opens the practice screen.
                <br />
                <strong>No participation amount is reserved yet.</strong>
                <br />
                The amount is only reserved if you continue and tap <strong>Ready for Task</strong>.
              </div>
            </div>

            {!isDemo ? (
              <div className="mb-6 text-[12px] text-[#7A7A7A]">
                Available now: <strong>{fmtUsd(availableUsd)}</strong>
              </div>
            ) : (
              <div className="mb-6 text-[12px] text-[#7A7A7A]">
                Demo mode uses local practice funds only.
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 h-[48px] border border-[#E5E5E5] rounded-xl text-[14px] font-medium text-[#7A7A7A]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmStartTask}
                className="flex-1 h-[48px] bg-[#2563FF] text-white text-[14px] font-semibold rounded-xl"
              >
                Open Practice
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
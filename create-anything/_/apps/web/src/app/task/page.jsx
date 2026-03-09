"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { GripVertical } from "lucide-react";

import {
  getMode,
  isDemoMode,
  getCurrent,
  submitTask,
  acceptJob,
  upsertWaiting,
  getAttemptIdStorage,
  saveAttemptIdStorage,
  clearAttemptIdStorage,
} from "@/utils/runtimeData";

import { goReal } from "@/utils/navigation";

/**
 * Task page（create-anything）
 * ✅ submit後は waiting画面に行かず "/" に戻す
 * ✅ waiting / forfeited / results の履歴表示は Home に集約（Taskには出さない）
 * ✅ timer は「カウントダウン後」に startedAt を確定（カウントダウン分を含めない）
 * ✅ Practiceは完了時にフィードバック表示（Correct / Try again）
 * ✅ Ready for Task を押した瞬間だけ real参加を確定する
 * ✅ Start / Practice の段階では絶対に課金しない
 * ✅ acceptJob の実シグネチャ acceptJob(priceUsd: number) に合わせる
 */

// -----------------------------
// misc helpers
// -----------------------------
function qs(name) {
  if (typeof window === "undefined") return null;
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

const isUuid = (s) =>
  typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );

function genTenNumbers() {
  const arr = [];
  for (let i = 0; i < 10; i++) arr.push(Math.floor(10 + Math.random() * 990));
  return arr;
}

function judgeDescending10(slots) {
  for (let i = 0; i < slots.length - 1; i++) {
    const a = Number(slots[i]);
    const b = Number(slots[i + 1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    if (a < b) return false;
  }
  return true;
}

function makeBoard() {
  return { numbers: genTenNumbers(), ordered: Array(10).fill(null) };
}

export default function TaskPage() {
  // -----------------------------
  // core state
  // -----------------------------
  const [serverStartedAtMs, setServerStartedAtMs] = useState(null);
  const [serverExpiresAtMs, setServerExpiresAtMs] = useState(null);

  const [phase, setPhase] = useState("loading"); // loading | practice | countdown | task | submitting | error
  const [error, setError] = useState(null);

  const [task] = useState({ id: "dev-task" });
  const [priceUsd, setPriceUsd] = useState(null);
  const [attemptId, setAttemptId] = useState(null);

  const [countdown, setCountdown] = useState(3);
  const countdownTimerRef = useRef(null);

  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedTimerRef = useRef(null);

  const [readySubmitting, setReadySubmitting] = useState(false);

  const draggedRef = useRef(null);

  // task board
  const [numbers, setNumbers] = useState(() => makeBoard().numbers);
  const [orderedNumbers, setOrderedNumbers] = useState(() => makeBoard().ordered);

  // practice board
  const [practiceNumbers, setPracticeNumbers] = useState(() => makeBoard().numbers);
  const [practiceOrdered, setPracticeOrdered] = useState(() => makeBoard().ordered);

  const [practiceResult, setPracticeResult] = useState(null); // null | { ok, message }

  const price = useMemo(() => qs("price"), []);
  const qpAttemptId = useMemo(() => qs("attemptId"), []);

  const attemptIdRef = useRef(null);

  // Ready時に取得した startedAt/expiresAt を一時保持
  const preStartedAtRef = useRef(null);
  const preExpiresAtRef = useRef(null);

  // -----------------------------
  // navigation
  // -----------------------------
  const goHome = useCallback(() => {
    if (typeof window !== "undefined") window.location.href = "/";
  }, []);

  function currentPath() {
    if (typeof window === "undefined") return "/";
    return window.location.pathname + window.location.search;
  }

  // -----------------------------
  // helpers
  // -----------------------------
  function getAttemptIdSafe() {
    return attemptIdRef.current || getAttemptIdStorage() || null;
  }

  // -----------------------------
  // keep refs
  // -----------------------------
  useEffect(() => {
    attemptIdRef.current = attemptId;
  }, [attemptId]);

  // -----------------------------
  // init attemptId / price
  // -----------------------------
  useEffect(() => {
    let aid = qpAttemptId || getAttemptIdStorage() || null;
    const priceVal = price ? Number(price) : null;

    // URLにattemptIdがない場合は復元してreplace
    if (typeof window !== "undefined" && !qs("attemptId") && isUuid(aid)) {
      const params = new URLSearchParams(window.location.search);
      params.set("attemptId", aid);
      if (priceVal != null && Number.isFinite(priceVal)) {
        params.set("price", String(priceVal));
      }
      window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
    }

    if (isUuid(aid)) {
      setAttemptId(aid);
      saveAttemptIdStorage(aid);
    } else {
      setAttemptId(null);
      clearAttemptIdStorage();
    }

    setPriceUsd(Number.isFinite(priceVal) ? priceVal : null);

    // 初期化
    setElapsedMs(0);
    setServerStartedAtMs(null);
    setServerExpiresAtMs(null);
    setReadySubmitting(false);
    preStartedAtRef.current = null;
    preExpiresAtRef.current = null;

    // 盤面初期化
    {
      const b = makeBoard();
      setNumbers(b.numbers);
      setOrderedNumbers(b.ordered);

      const pb = makeBoard();
      setPracticeNumbers(pb.numbers);
      setPracticeOrdered(pb.ordered);
      setPracticeResult(null);
    }

    setPhase("practice");
  }, []); // intentionally once

  // -----------------------------
  // countdown
  // -----------------------------
  useEffect(() => {
    if (phase !== "countdown") {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      return;
    }

    const COUNTDOWN_SECONDS = 10;

    setCountdown(COUNTDOWN_SECONDS);
    const endAt = Date.now() + COUNTDOWN_SECONDS * 1000;

    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    countdownTimerRef.current = setInterval(() => {
      const leftMs = endAt - Date.now();
      const leftSec = Math.max(0, Math.ceil(leftMs / 1000));
      setCountdown(leftSec);

      if (leftSec <= 0) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;

        const base = preStartedAtRef.current != null ? Number(preStartedAtRef.current) : Date.now();
        setServerStartedAtMs(base + COUNTDOWN_SECONDS * 1000);
        setServerExpiresAtMs(preExpiresAtRef.current != null ? Number(preExpiresAtRef.current) : null);
        setElapsedMs(0);

        const b = makeBoard();
        setNumbers(b.numbers);
        setOrderedNumbers(b.ordered);

        setPhase("task");
      }
    }, 100);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [phase]);

  // -----------------------------
  // task elapsed timer
  // -----------------------------
  useEffect(() => {
    if (phase !== "task") {
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
      return;
    }
    if (serverStartedAtMs == null) return;

    let cancelled = false;
    const startedAt = Number(serverStartedAtMs);

    const tick = () => {
      const now = Date.now();
      const ms = Math.max(0, now - startedAt);
      if (!cancelled) setElapsedMs(ms);
    };

    tick();
    elapsedTimerRef.current = setInterval(tick, 50);

    return () => {
      cancelled = true;
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
    };
  }, [phase, serverStartedAtMs]);

  // -----------------------------
  // drag/drop
  // -----------------------------
  function handleDragStart(e, index, fromPool, isPractice) {
    draggedRef.current = { index, fromPool, isPractice };
    try {
      e.dataTransfer.setData("text/plain", "x");
    } catch {}
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleDropToSlot(e, slotIndex, isPractice) {
    e.preventDefault();
    if (isPractice) setPracticeResult(null);

    const drag = draggedRef.current;
    if (!drag) return;

    if (drag.isPractice !== isPractice) {
      draggedRef.current = null;
      return;
    }

    const pool = isPractice ? practiceNumbers : numbers;
    const setPool = isPractice ? setPracticeNumbers : setNumbers;

    const ordered = isPractice ? practiceOrdered : orderedNumbers;
    const setOrdered = isPractice ? setPracticeOrdered : setOrderedNumbers;

    const slots = ordered.slice();
    const newPool = pool.slice();
    const dstValue = slots[slotIndex];
    let value = null;

    // A) slot -> slot
    if (!drag.fromPool) {
      const srcIndex = drag.index;
      if (srcIndex === slotIndex) {
        draggedRef.current = null;
        return;
      }

      value = slots[srcIndex];
      if (value == null) {
        draggedRef.current = null;
        return;
      }

      slots[slotIndex] = value;
      slots[srcIndex] = dstValue ?? null;

      setOrdered(slots);
      draggedRef.current = null;

      if (slots.every((x) => x !== null)) {
        if (!isPractice) {
          submitNow(slots);
        } else {
          const ok = judgeDescending10(slots);
          setPracticeResult(
            ok
              ? { ok: true, message: "Correct! ✅ You're ready to start the task." }
              : { ok: false, message: "Check the order ❌ Please try again." }
          );
        }
      }
      return;
    }

    // B) pool -> slot
    value = newPool[drag.index];
    if (value == null) {
      draggedRef.current = null;
      return;
    }

    newPool[drag.index] = null;
    slots[slotIndex] = value;

    if (dstValue != null) {
      if (newPool[drag.index] == null) {
        newPool[drag.index] = dstValue;
      } else {
        const empty = newPool.findIndex((x) => x == null);
        if (empty >= 0) newPool[empty] = dstValue;
        else {
          slots[slotIndex] = dstValue;
          newPool[drag.index] = value;
          setPool(newPool);
          setOrdered(slots);
          draggedRef.current = null;
          return;
        }
      }
    }

    setPool(newPool);
    setOrdered(slots);
    draggedRef.current = null;

    if (slots.every((x) => x !== null)) {
      if (!isPractice) {
        submitNow(slots);
      } else {
        const ok = judgeDescending10(slots);
        setPracticeResult(
          ok
            ? { ok: true, message: "Correct! ✅ You're ready to start the task." }
            : { ok: false, message: "Check the order ❌ Please try again." }
        );
      }
    }
  }

  // -----------------------------
  // actions
  // -----------------------------
  async function handleReadyForReal() {
    if (readySubmitting) return;

    setError(null);
    setReadySubmitting(true);

    // DEMO: 課金なし
    if (isDemoMode() || getMode() === "demo" || qs("mode") === "demo") {
      preStartedAtRef.current = Date.now();
      preExpiresAtRef.current = null;
      setPracticeResult(null);
      setReadySubmitting(false);
      setPhase("countdown");
      return;
    }

    try {
      const p = Number(priceUsd);
      if (!Number.isFinite(p) || p <= 0) {
        throw new Error("invalid priceUsd");
      }

      // ★ Ready押下時に初めて real参加を確定
      const accepted = await acceptJob(p);

      if (accepted && accepted.ok === false) {
        throw new Error(accepted.error || "acceptJob failed");
      }

      // acceptJob が attemptId / id を返すなら優先して採用
      const acceptedAttemptId =
        accepted?.attemptId ||
        accepted?.id ||
        accepted?.attempt?.id ||
        null;

      let aid = acceptedAttemptId || getAttemptIdSafe() || null;

      if (!isUuid(aid)) {
        throw new Error("acceptJob did not return a valid attemptId");
      }

      // 状態へ反映
      setAttemptId(aid);
      saveAttemptIdStorage(aid);
      attemptIdRef.current = aid;

      // current取得
      const data = await getCurrent(aid);

      if (!data || data.ok === false) {
        throw new Error((data && data.error) || "current failed");
      }

      if (Object.prototype.hasOwnProperty.call(data, "hasTask") && data.hasTask === false) {
        throw new Error("current: hasTask=false (attempt not found?)");
      }

      const startedAt = data.startedAt ? new Date(data.startedAt).getTime() : Date.now();
      const expiresAt = data.expiresAt ? new Date(data.expiresAt).getTime() : null;

      preStartedAtRef.current = startedAt;
      preExpiresAtRef.current = expiresAt;

      setPracticeResult(null);
      setReadySubmitting(false);
      setPhase("countdown");
    } catch (e) {
      const msg = String((e && e.message) || e);

      setReadySubmitting(false);

      if (
        (e && e.code === "AUTH_REQUIRED") ||
        msg.toLowerCase().includes("auth") ||
        msg.toLowerCase().includes("401")
      ) {
        goReal(currentPath());
        return;
      }

      setError(msg);
      setPhase("error");
    }
  }

  async function submitNow(finalSlots) {
    if (phase === "submitting") return;

    const aid = getAttemptIdSafe();
    if (!isUuid(aid)) {
      setError("missing/invalid attemptId");
      setPhase("error");
      return;
    }

    const ordered = finalSlots.map((x) => Number(x));
    const stakeCents =
      priceUsd != null && Number.isFinite(Number(priceUsd))
        ? Math.trunc(Number(priceUsd) * 100)
        : 0;

    setPhase("submitting");
    setError(null);

    try {
      const data = await submitTask({
        attemptId: aid,
        orderedNumbers: ordered,
        taskId: (task && task.id) || "dev-task",
        stakeCents,
        priceUsd: priceUsd ?? null,
        elapsedMs: elapsedMs,
        timeMs: elapsedMs,
      });

      if (!data || data.ok === false) {
        throw new Error((data && data.error) || "submit failed");
      }

      const sid = data.submissionId || data.id || null;
      if (!isUuid(sid)) throw new Error("submit returned invalid submissionId");

      const st = String(data.statusCompat || data.status || "").toLowerCase();
      if (!data.matchId && st.includes("wait")) {
        upsertWaiting({
          submissionId: sid,
          attemptId: aid,
          priceUsd: priceUsd ?? null,
          stakeCents,
          savedAt: Date.now(),
          status: "WAITING",
        });
      }

      goHome();
    } catch (e) {
      const msg = String((e && e.message) || e);

      if (
        !isDemoMode() &&
        ((e && e.code === "AUTH_REQUIRED") ||
          msg.toLowerCase().includes("auth") ||
          msg.toLowerCase().includes("401"))
      ) {
        goReal(currentPath());
        return;
      }

      setError(msg);
      setPhase("error");
    }
  }

  // -----------------------------
  // UI
  // -----------------------------
  if (phase === "loading") {
    return <div style={{ padding: 24, fontFamily: "system-ui" }}>Loading...</div>;
  }

  if (phase === "error") {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h2 style={{ marginBottom: 8 }}>Error</h2>
        <div style={{ padding: 12, background: "#fee", border: "1px solid #f99" }}>
          {error || "unknown error"}
        </div>
        <button
          onClick={goHome}
          style={{
            marginTop: 16,
            padding: "10px 14px",
            border: "1px solid #ddd",
            borderRadius: 8,
          }}
        >
          Home
        </button>
      </div>
    );
  }

  if (phase === "countdown") {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 120, fontWeight: 800 }}>{countdown}</div>
          <div style={{ fontSize: 24 }}>Get Ready...</div>
        </div>
      </div>
    );
  }

  if (phase === "practice") {
    return (
      <div className="min-h-screen bg-white font-inter">
        <div className="border-b border-[#EDEDED]">
          <div className="max-w-[800px] mx-auto px-6 h-[64px] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 border-4 border-[#2563FF] rounded-full"></div>
              <span className="text-[16px] font-semibold text-[#2B2B2B]">
                Task Dash {priceUsd != null ? `- $${priceUsd}` : ""}
                {isDemoMode() ? " (Demo)" : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-[800px] mx-auto px-6 py-8">
          <div className="bg-[#FEF3C7] border border-[#F59E0B] rounded-xl p-6 mb-6">
            <h2 className="text-[18px] font-semibold text-[#92400E] mb-3">Task Rules</h2>
            <ul className="space-y-2 text-[14px] text-[#78350F]">
              <li>
                • <strong>Goal:</strong> Arrange 10 numbers in descending order (largest → smallest)
              </li>
              <li>
                • <strong>How to work:</strong> Drag numbers from the pool into all 10 slots
              </li>
              <li>
                • <strong>Submission:</strong> When all slots are filled, your response is submitted automatically
              </li>
              <li>
                • <strong>Evaluation:</strong> Your work is assessed based on speed and accuracy
              </li>
              <li>
                <span
                  style={{
                    display: "inline-block",
                    color: "#111",
                    fontWeight: "bold",
                    fontSize: "14px",
                    marginRight: "6px",
                    verticalAlign: "middle",
                  }}
                >
                  ※
                </span>
                <span style={{ display: "inline-block" }}>
                  Submissions are evaluated based on work quality (speed &amp; accuracy)
                </span>
                <span style={{ display: "block", marginLeft: "22px" }}>
                  and compared with another participant’s submission for payout allocation.
                </span>
              </li>
            </ul>
          </div>

          <div className="bg-white border border-[#F1F1F1] rounded-xl p-8">
            <h3 className="text-[18px] font-semibold text-[#2B2B2B] mb-2">Practice Mode</h3>
            <p className="text-[14px] text-[#7A7A7A] mb-6">
              Try sorting these practice numbers. This does not affect evaluation or payout.
            </p>

            <div className="mb-8">
              <div className="text-[13px] font-medium text-[#2B2B2B] mb-3">Your Practice Answer:</div>

              {practiceResult && (
                <div
                  className={`mb-4 rounded-lg px-4 py-3 text-[14px] font-medium ${
                    practiceResult.ok
                      ? "bg-[#ECFDF5] text-[#065F46] border border-[#10B981]"
                      : "bg-[#FEF2F2] text-[#991B1B] border border-[#EF4444]"
                  }`}
                >
                  {practiceResult.message}
                </div>
              )}

              {practiceResult && !practiceResult.ok && (
                <button
                  onClick={() => {
                    const b = makeBoard();
                    setPracticeNumbers(b.numbers);
                    setPracticeOrdered(b.ordered);
                    setPracticeResult(null);
                  }}
                  className="mb-6 px-4 py-2 rounded-lg bg-[#111827] text-white text-[14px] font-semibold"
                >
                  Try Again
                </button>
              )}

              <div className="grid grid-cols-5 gap-3">
                {practiceOrdered.map((num, index) => (
                  <div
                    key={index}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropToSlot(e, index, true)}
                    className={`h-[80px] border-2 border-dashed rounded-lg flex items-center justify-center text-[24px] font-semibold ${
                      num === null
                        ? "border-[#E5E5E5] bg-[#FAFAFA] text-[#C3C3C3]"
                        : "border-[#10B981] bg-[#ECFDF5] text-[#10B981] cursor-move"
                    }`}
                    draggable={num !== null}
                    onDragStart={(e) => num !== null && handleDragStart(e, index, false, true)}
                  >
                    {num === null ? index + 1 : num}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[13px] font-medium text-[#2B2B2B] mb-3">Practice Number Pool:</div>
              <div className="grid grid-cols-5 gap-3">
                {practiceNumbers.map((num, index) => (
                  <div
                    key={index}
                    draggable={num !== null}
                    onDragStart={(e) => num !== null && handleDragStart(e, index, true, true)}
                    className={`h-[80px] bg-white border-2 rounded-lg flex items-center justify-center text-[24px] font-semibold cursor-move hover:bg-[#F8FAFC] ${
                      num === null
                        ? "border-[#E5E5E5] text-[#C3C3C3] cursor-not-allowed"
                        : "border-[#E5E5E5] text-[#2B2B2B] hover:border-[#10B981]"
                    }`}
                  >
                    <GripVertical size={16} className="text-[#C3C3C3] mr-2" />
                    {num === null ? "-" : num}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-[#EDEDED]">
              <button
                onClick={handleReadyForReal}
                disabled={readySubmitting}
                className={`w-full h-[56px] text-white text-[16px] font-semibold rounded-lg ${
                  readySubmitting
                    ? "bg-[#6EE7B7] cursor-not-allowed"
                    : "bg-[#10B981] hover:bg-[#059669]"
                }`}
              >
                {readySubmitting ? "Preparing Task..." : "Ready for Task →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // phase === "task" or "submitting"
  return (
    <div className="min-h-screen bg-white font-inter">
      <div className="border-b border-[#EDEDED]">
        <div className="max-w-[800px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-4 border-[#2563FF] rounded-full"></div>
            <span className="text-[16px] font-semibold text-[#2B2B2B]">
              Task Dash {priceUsd != null ? `- $${priceUsd}` : ""}
              {isDemoMode() ? " (Demo)" : ""}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-[20px] font-mono font-semibold text-[#2563FF]">
              {(elapsedMs / 1000).toFixed(2)}s
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[800px] mx-auto px-6 py-8">
        <div className="bg-white border border-[#F1F1F1] rounded-xl p-8">
          <h1 className="text-[20px] font-semibold text-[#2B2B2B] mb-2">
            Sort Numbers in Descending Order
          </h1>
          <p className="text-[14px] text-[#7A7A7A] mb-2">
            Drag numbers into slots. Auto-submits when all slots are filled.
          </p>

          <div className="mb-8">
            <div className="text-[13px] font-medium text-[#2B2B2B] mb-3">Your Answer:</div>
            <div className="grid grid-cols-5 gap-3">
              {orderedNumbers.map((num, index) => (
                <div
                  key={index}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropToSlot(e, index, false)}
                  className={`h-[80px] border-2 border-dashed rounded-lg flex items-center justify-center text-[24px] font-semibold ${
                    num === null
                      ? "border-[#E5E5E5] bg-[#FAFAFA] text-[#C3C3C3]"
                      : "border-[#2563FF] bg-[#EFF6FF] text-[#2563FF] cursor-move"
                  }`}
                  draggable={num !== null && phase !== "submitting"}
                  onDragStart={(e) => num !== null && handleDragStart(e, index, false, false)}
                >
                  {num === null ? index + 1 : num}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[13px] font-medium text-[#2B2B2B] mb-3">Number Pool:</div>
            <div className="grid grid-cols-5 gap-3">
              {numbers.map((num, index) => (
                <div
                  key={index}
                  draggable={num !== null && phase !== "submitting"}
                  onDragStart={(e) => num !== null && handleDragStart(e, index, true, false)}
                  className={`h-[80px] bg-white border-2 rounded-lg flex items-center justify-center text-[24px] font-semibold cursor-move hover:bg-[#F8FAFC] ${
                    num === null
                      ? "border-[#E5E5E5] text-[#C3C3C3] cursor-not-allowed"
                      : "border-[#E5E5E5] text-[#2B2B2B] hover:border-[#2563FF]"
                  }`}
                >
                  <GripVertical size={16} className="text-[#C3C3C3] mr-2" />
                  {num === null ? "-" : num}
                </div>
              ))}
            </div>
          </div>

          {phase === "submitting" && (
            <div className="mt-8 pt-6 border-t border-[#EDEDED]">
              <div className="text-center text-[16px] text-[#2563FF] font-semibold">
                Submitting...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
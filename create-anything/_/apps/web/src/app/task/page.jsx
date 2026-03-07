"use client";

console.log("🚀 TASK page.jsx IS LOADED 🚀");

import { useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, RefreshCw, BookOpen } from "lucide-react";
import { navigate } from "@/utils/navigation";
import { authenticatedFetch, getAccessToken } from "@/utils/auth";
import { isDemoMode as rtIsDemoMode } from "@/utils/runtimeData";

/* ===============================
   helpers
================================ */
function toNum(v, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const getAttemptIdFromStart = (data) =>
  String(data?.attempt?.id || data?.attemptId || data?.id || "");

const getNumbersFromStart = (data) => {
  const nums = data?.attempt?.numbers ?? data?.numbers;
  return Array.isArray(nums) ? nums : [];
};

const getAttemptIdFromSubmit = (data, fallbackAttemptId) =>
  String(
    data?.attempt?.id ||
      data?.attemptId ||
      data?.id ||
      data?.attempt?.attemptId ||
      fallbackAttemptId ||
      ""
  );

function makeDemoAttemptId() {
  return `demo-attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeDemoResultId() {
  return `demo-result-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeDemoNumbers(count = 10) {
  const set = new Set();
  while (set.size < count) {
    set.add(Math.floor(Math.random() * 900) + 100);
  }
  return Array.from(set);
}

function safeLocalSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function safeLocalGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveDemoResult(payload) {
  const resultId = payload?.id || makeDemoResultId();
  const record = {
    ok: true,
    mode: "demo",
    id: resultId,
    attemptId: payload?.attemptId || "",
    price: toNum(payload?.price, 1),
    timeMs: toNum(payload?.timeMs, 0),
    elapsedMs: toNum(payload?.elapsedMs, 0),
    durationMs: toNum(payload?.durationMs, 0),
    numbers: Array.isArray(payload?.numbers) ? payload.numbers : [],
    orderedNumbers: Array.isArray(payload?.orderedNumbers)
      ? payload.orderedNumbers
      : [],
    submittedAt: Date.now(),
    result: "demo",
  };

  safeLocalSet("lastSubmissionId", resultId);
  safeLocalSet("taskdash_v2_submissionId", resultId);
  safeLocalSet("taskdash_submissionId", resultId);
  safeLocalSet("taskdash_demo_last_result_id", resultId);
  safeLocalSet("taskdash_demo_last_result", JSON.stringify(record));
  safeLocalSet(`taskdash_demo_result_${resultId}`, JSON.stringify(record));

  const existingRaw = safeLocalGet("taskdash_demo_results");
  let arr = [];
  try {
    arr = existingRaw ? JSON.parse(existingRaw) : [];
    if (!Array.isArray(arr)) arr = [];
  } catch {
    arr = [];
  }
  arr.unshift(record);
  safeLocalSet("taskdash_demo_results", JSON.stringify(arr.slice(0, 20)));

  return resultId;
}

/* ===============================
   TaskPage
================================ */
export default function TaskPage() {
  const [attemptId, setAttemptId] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [orderedNumbers, setOrderedNumbers] = useState(Array(10).fill(null));

  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState("warmup"); // warmup | countdown | task
  const [countdown, setCountdown] = useState(10);
  const [bootError, setBootError] = useState("");

  const [selectedPick, setSelectedPick] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);

  const draggedIndexRef = useRef(null);
  const practiceDraggedIndexRef = useRef(null);
  const timerRef = useRef(null);

  const [price, setPrice] = useState(1);
  const isDemo = rtIsDemoMode();

  const [practiceNumbers] = useState([45, 23, 89, 12, 67, 34, 91, 56, 78, 29]);
  const [practiceOrdered, setPracticeOrdered] = useState(Array(10).fill(null));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = Number(
      new URLSearchParams(window.location.search).get("price") || "1"
    );
    setPrice(toNum(p, 1));
    setPhase("warmup");
  }, []);

  /* ===============================
     start task
  ================================ */
  const startTask = async (forcedPrice) => {
    const actualPrice = toNum(forcedPrice != null ? forcedPrice : price, 1);

    setBootError("");

    if (isDemo) {
      const demoAttemptId = makeDemoAttemptId();
      const demoNumbers = makeDemoNumbers(10);

      setAttemptId(demoAttemptId);
      setNumbers(demoNumbers);
      setOrderedNumbers(Array(10).fill(null));
      setSelectedPick(null);
      setStartTime(null);
      setElapsedTime(0);
      return;
    }

    const token = getAccessToken();
    if (!token) {
      throw new Error("missing taskdash_access_token");
    }

    const r = await authenticatedFetch("/api/tasks/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: actualPrice }),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok || data?.ok === false) {
      throw new Error(data?.error || "start failed");
    }

    const newAttemptId = getAttemptIdFromStart(data);
    const nums = getNumbersFromStart(data);

    if (!newAttemptId) throw new Error("start: missing attempt.id");
    if (nums.length !== 10) throw new Error("start: numbers missing (need 10)");

    setAttemptId(newAttemptId);
    setNumbers(nums);
    setOrderedNumbers(Array(10).fill(null));
    setSelectedPick(null);
    setStartTime(null);
    setElapsedTime(0);
  };

  const handleReadyForReal = async () => {
    try {
      setBootError("");

      if (!isDemo) {
        const token = getAccessToken();
        if (!token) {
          navigate(
            `/login?redirect=${encodeURIComponent(`/task?price=${price}`)}`
          );
          return;
        }
      }

      await startTask(price);
      setCountdown(10);
      setPhase("countdown");
    } catch (e) {
      const msg = e?.message || String(e);
      console.error("READY_ERROR =", msg);
      setBootError(msg);
      setPhase("warmup");
    }
  };

  /* ===============================
     countdown
  ================================ */
  useEffect(() => {
    if (phase !== "countdown") return;

    if (countdown <= 0) {
      setPhase("task");
      setStartTime(Date.now());
      setElapsedTime(0);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [phase, countdown]);

  /* ===============================
     task timer
  ================================ */
  useEffect(() => {
    if (phase !== "task" || !startTime) return;

    timerRef.current = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 50);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, startTime]);

  /* ===============================
     drag & drop (real task)
  ================================ */
  const handleDragStart = (index) => {
    draggedIndexRef.current = index;
  };

  const handleDrop = (targetIndex) => {
    if (draggedIndexRef.current == null) return;

    const srcIdx = draggedIndexRef.current;
    const picked = numbers[srcIdx];

    if (picked == null) {
      draggedIndexRef.current = null;
      return;
    }

    const next = [...orderedNumbers];
    next[targetIndex] = picked;
    setOrderedNumbers(next);
    setSelectedPick(null);
    draggedIndexRef.current = null;
  };

  /* ===============================
     drag & drop (practice)
  ================================ */
  const handlePracticeDragStart = (index) => {
    practiceDraggedIndexRef.current = index;
  };

  const handlePracticeDrop = (targetIndex) => {
    if (practiceDraggedIndexRef.current == null) return;

    const srcIdx = practiceDraggedIndexRef.current;
    const picked = practiceNumbers[srcIdx];

    if (picked == null) {
      practiceDraggedIndexRef.current = null;
      return;
    }

    const next = [...practiceOrdered];
    next[targetIndex] = picked;
    setPracticeOrdered(next);
    practiceDraggedIndexRef.current = null;
  };

  /* ===============================
     click-to-place (real task)
  ================================ */
  const onPickClick = (num) => {
    if (submitting || phase !== "task") return;
    setSelectedPick((prev) => (prev === num ? null : num));
  };

  const onSlotClick = (i) => {
    if (submitting || phase !== "task") return;
    if (selectedPick == null) return;
    const next = [...orderedNumbers];
    next[i] = selectedPick;
    setOrderedNumbers(next);
    setSelectedPick(null);
  };

  /* ===============================
     reset
  ================================ */
  const onReset = () => {
    setOrderedNumbers(Array(10).fill(null));
    setSelectedPick(null);
    setStartTime(Date.now());
    setElapsedTime(0);
    setShowResetModal(false);
  };

  /* ===============================
     auto submit
  ================================ */
  useEffect(() => {
    if (phase !== "task") return;
    if (submitting) return;
    if (!attemptId) return;
    if (!startTime) return;
    if (orderedNumbers.some((n) => n == null)) return;

    (async () => {
      try {
        setSubmitting(true);

        const timeMs = Math.max(0, Date.now() - startTime);
        const answer = orderedNumbers.map((n) => Number(n));

        if (isDemo) {
          const resultId = saveDemoResult({
            id: makeDemoResultId(),
            attemptId,
            price,
            timeMs,
            elapsedMs: timeMs,
            durationMs: timeMs,
            numbers,
            orderedNumbers: answer,
          });
          navigate(`/result/${resultId}`);
          return;
        }

        const token = getAccessToken();
        if (!token) {
          throw new Error("missing taskdash_access_token");
        }

        const r = await authenticatedFetch("/api/tasks/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId,
            orderedNumbers: answer,
            numbers: answer,
            timeMs,
            elapsedMs: timeMs,
            durationMs: timeMs,
          }),
        });

        const data = await r.json().catch(() => ({}));

        if (!r.ok || data?.ok === false) {
          throw new Error(data?.error || "submit failed");
        }

        const idForResult = getAttemptIdFromSubmit(data, attemptId);
        navigate(`/result/${idForResult}`);
      } catch (e) {
        alert(e?.message || String(e));
      } finally {
        setSubmitting(false);
      }
    })();
  }, [orderedNumbers, phase, submitting, attemptId, startTime, isDemo, price, numbers]);

  /* ===============================
     derived
  ================================ */
  const filledCount = useMemo(
    () => orderedNumbers.filter((n) => n != null).length,
    [orderedNumbers]
  );

  /* ===============================
     boot error
  ================================ */
  if (bootError) {
    return (
      <div className="min-h-screen bg-white font-inter flex items-center justify-center p-6">
        <div className="max-w-[720px] w-full border border-[#F1F1F1] rounded-xl p-6">
          <div className="text-[16px] font-semibold text-[#2B2B2B] mb-2">
            Error
          </div>
          <pre className="text-[12px] text-[#C33] whitespace-pre-wrap">
            {bootError}
          </pre>

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => {
                setBootError("");
                setPhase("warmup");
              }}
              className="flex-1 h-[48px] border border-[#E5E5E5] rounded-lg text-[14px] font-medium text-[#7A7A7A] hover:border-[#2563FF] hover:text-[#2563FF]"
            >
              Back
            </button>
            <button
              onClick={handleReadyForReal}
              className="flex-1 h-[48px] bg-[#2563FF] text-white text-[14px] font-semibold rounded-lg"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ===============================
     warmup UI
  ================================ */
  if (phase === "warmup") {
    return (
      <div className="min-h-screen bg-white font-inter">
        <div className="border-b border-[#EDEDED]">
          <div className="max-w-[800px] mx-auto px-6 h-[64px] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 border-4 border-[#2563FF] rounded-full"></div>
              <span className="text-[16px] font-semibold text-[#2B2B2B]">
                Task Dash - ${toNum(price, 1)}
              </span>
            </div>

            {isDemo && (
              <div className="px-3 py-2 rounded-lg bg-[#EFF6FF] text-[#2563FF] text-[12px] font-semibold">
                DEMO MODE
              </div>
            )}
          </div>
        </div>

        <div className="max-w-[800px] mx-auto px-6 py-8">
          <div className="bg-[#FEF3C7] border border-[#F59E0B] rounded-xl p-6 mb-6">
            <h2 className="text-[18px] font-semibold text-[#92400E] mb-3">
              📋 Task Rules
            </h2>
            <ul className="space-y-2 text-[14px] text-[#78350F]">
              <li>
                • <strong>Goal:</strong> Sort 10 numbers in descending order
                (largest → smallest)
              </li>
              <li>
                • <strong>Method:</strong> Drag numbers from the pool into all
                10 slots
              </li>
              <li>
                • <strong>Important:</strong> Once all slots are filled, the
                task auto-submits immediately
              </li>
              <li>
                • <strong>No changes after:</strong> You cannot rearrange
                numbers after all slots are filled
              </li>
              <li>
                • <strong>Speed matters:</strong> Faster + accurate = better
                rewards
              </li>
              <li>
                • <strong>Fair difficulty:</strong> The real task uses the live
                task generator for all users
              </li>
            </ul>
          </div>

          <div className="bg-white border border-[#F1F1F1] rounded-xl p-8">
            <h3 className="text-[18px] font-semibold text-[#2B2B2B] mb-2">
              Practice Here
            </h3>
            <p className="text-[14px] text-[#7A7A7A] mb-6">
              Try sorting these practice numbers. This won't affect your score.
            </p>

            <div className="mb-8">
              <div className="text-[13px] font-medium text-[#2B2B2B] mb-3">
                Your Practice Answer:
              </div>
              <div className="grid grid-cols-5 gap-3">
                {practiceOrdered.map((num, index) => (
                  <div
                    key={index}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handlePracticeDrop(index)}
                    className={`h-[80px] border-2 border-dashed rounded-lg flex items-center justify-center text-[24px] font-semibold ${
                      num == null
                        ? "border-[#E5E5E5] bg-[#FAFAFA] text-[#C3C3C3]"
                        : "border-[#10B981] bg-[#ECFDF5] text-[#10B981]"
                    }`}
                  >
                    {num == null ? index + 1 : num}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[13px] font-medium text-[#2B2B2B] mb-3">
                Practice Number Pool:
              </div>
              <div className="grid grid-cols-5 gap-3">
                {practiceNumbers.map((num, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={() => handlePracticeDragStart(index)}
                    className="h-[80px] bg-white border-2 border-[#E5E5E5] rounded-lg flex items-center justify-center text-[24px] font-semibold text-[#2B2B2B] cursor-move hover:border-[#10B981] hover:bg-[#F8FAFC]"
                  >
                    <GripVertical size={16} className="text-[#C3C3C3] mr-2" />
                    {num}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-[#EDEDED] flex gap-3">
              <a
                href="/rules"
                className="flex-1 h-[56px] border border-[#E5E5E5] rounded-lg text-[16px] font-semibold text-[#7A7A7A] flex items-center justify-center gap-2 hover:border-[#2563FF] hover:text-[#2563FF]"
              >
                <BookOpen size={18} />
                Rules
              </a>

              <button
                onClick={handleReadyForReal}
                className="flex-1 h-[56px] bg-[#10B981] text-white text-[16px] font-semibold rounded-lg hover:bg-[#059669]"
              >
                Ready for Real Task →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ===============================
     countdown UI
  ================================ */
  if (phase === "countdown") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2563FF] to-[#1E40AF] font-inter flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-[120px] font-bold mb-6">
            {countdown}
          </div>
          <div className="text-[24px] text-blue-100 font-medium">
            Get Ready...
          </div>
        </div>
      </div>
    );
  }

  /* ===============================
     task UI
  ================================ */
  return (
    <div className="min-h-screen bg-white font-inter">
      <div className="border-b border-[#EDEDED]">
        <div className="max-w-[800px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-4 border-[#2563FF] rounded-full"></div>
            <span className="text-[16px] font-semibold text-[#2B2B2B]">
              Task Dash - ${toNum(price, 1)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-[20px] font-mono font-semibold text-[#2563FF]">
              {(elapsedTime / 1000).toFixed(2)}s
            </div>

            <button
              onClick={() => setShowResetModal(true)}
              disabled={submitting}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-[#E5E5E5] text-[#2B2B2B] text-[13px] font-semibold rounded-lg hover:border-[#2563FF] disabled:opacity-50"
            >
              <RefreshCw size={16} />
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[800px] mx-auto px-6 py-8">
        <div className="bg-white border border-[#F1F1F1] rounded-xl p-8">
          <h1 className="text-[20px] font-semibold text-[#2B2B2B] mb-2">
            Sort Numbers in Descending Order
          </h1>
          <p className="text-[14px] text-[#7A7A7A] mb-2">
            Drag numbers from the pool below into the slots. Auto-submits when
            all slots are filled.
          </p>
          <p className="text-[12px] text-[#7A7A7A] mb-8">
            attemptId:{" "}
            <span className="font-mono text-[#2B2B2B]">{attemptId}</span> ·
            Progress:{" "}
            <span className="font-semibold text-[#2B2B2B]">{filledCount}/10</span>
          </p>

          <div className="mb-8">
            <div className="text-[13px] font-medium text-[#2B2B2B] mb-3">
              Your Answer:
            </div>
            <div className="grid grid-cols-5 gap-3">
              {orderedNumbers.map((num, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => onSlotClick(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(index)}
                  disabled={submitting}
                  className={`h-[80px] border-2 border-dashed rounded-lg flex items-center justify-center text-[24px] font-semibold transition ${
                    num == null
                      ? selectedPick != null
                        ? "border-[#2563FF] bg-[#EFF6FF] text-[#2563FF]"
                        : "border-[#E5E5E5] bg-[#FAFAFA] text-[#C3C3C3]"
                      : "border-[#2563FF] bg-[#EFF6FF] text-[#2563FF]"
                  } ${submitting ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  {num == null ? index + 1 : num}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[13px] font-medium text-[#2B2B2B] mb-3">
              Number Pool:
            </div>
            <div className="grid grid-cols-5 gap-3">
              {numbers.map((num, index) => {
                const active = selectedPick === num;
                return (
                  <button
                    key={index}
                    type="button"
                    draggable={!submitting}
                    onDragStart={() => handleDragStart(index)}
                    onClick={() => onPickClick(num)}
                    disabled={submitting}
                    className={`h-[80px] bg-white border-2 rounded-lg flex items-center justify-center text-[24px] font-semibold cursor-move transition ${
                      active
                        ? "border-[#2563FF] bg-[#2563FF] text-white"
                        : "border-[#E5E5E5] text-[#2B2B2B] hover:border-[#2563FF] hover:bg-[#F8FAFC]"
                    } ${submitting ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <GripVertical
                      size={16}
                      className={active ? "opacity-80 mr-2" : "text-[#C3C3C3] mr-2"}
                    />
                    {num}
                  </button>
                );
              })}
            </div>
          </div>

          {submitting && (
            <div className="mt-8 pt-6 border-t border-[#EDEDED]">
              <div className="text-center text-[16px] text-[#2563FF] font-semibold">
                Submitting...
              </div>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-[#EDEDED] text-[12px] text-[#7A7A7A]">
            Tip: Drag &amp; drop also works.
          </div>
        </div>

        <a
          href="/balance"
          className="mt-6 w-full h-[48px] border border-[#E5E5E5] rounded-lg text-[14px] font-medium text-[#7A7A7A] flex items-center justify-center gap-2 hover:border-[#2563FF] hover:text-[#2563FF]"
        >
          Back to Dashboard
        </a>
      </div>

      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-8 max-w-[400px] w-full">
            <h3 className="text-[18px] font-semibold text-[#2B2B2B] mb-4">
              Reset Task
            </h3>
            <p className="text-[13px] text-[#7A7A7A] mb-6">
              This clears all slots and resets the timer.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                disabled={submitting}
                className="flex-1 h-[48px] border border-[#E5E5E5] rounded-lg text-[14px] font-medium text-[#7A7A7A] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={onReset}
                disabled={submitting}
                className="flex-1 h-[48px] bg-[#2563FF] text-white text-[14px] font-semibold rounded-lg disabled:opacity-50"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
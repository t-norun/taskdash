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
    orderedNumbers: Array.isArray(payload?.orderedNumbers) ? payload.orderedNumbers : [],
    submittedAt: Date.now(),
    result: "demo",
  };

  safeLocalSet("lastSubmissionId", resultId);
  safeLocalSet("taskdash_v2_submissionId", resultId);
  safeLocalSet("taskdash_submissionId", resultId);
  safeLocalSet("taskdash_demo_last_result_id", resultId);
  safeLocalSet("taskdash_demo_last_result", JSON.stringify(record));

  const byIdKey = `taskdash_demo_result_${resultId}`;
  safeLocalSet(byIdKey, JSON.stringify(record));

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
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState("loading");
  const [bootError, setBootError] = useState("");

  const [selectedPick, setSelectedPick] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);

  const startedRef = useRef(false);
  const draggedIndexRef = useRef(null);

  const [price, setPrice] = useState(1);
  const isDemo = rtIsDemoMode();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = Number(
      new URLSearchParams(window.location.search).get("price") || "1"
    );
    setPrice(toNum(p, 1));
  }, []);

  /* ===============================
     start task
  ================================ */
  const startTask = async (forcedPrice) => {
    setBootError("");
    setPhase("loading");

    const actualPrice = toNum(
      forcedPrice != null ? forcedPrice : price,
      1
    );

    if (isDemo) {
      const demoAttemptId = makeDemoAttemptId();
      const demoNumbers = makeDemoNumbers(10);

      setAttemptId(demoAttemptId);
      setNumbers(demoNumbers);
      setOrderedNumbers(Array(10).fill(null));
      setSelectedPick(null);
      setStartTime(Date.now());
      setPhase("task");
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
    setStartTime(Date.now());
    setPhase("task");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (startedRef.current) return;
    startedRef.current = true;

    const p = Number(
      new URLSearchParams(window.location.search).get("price") || "1"
    );
    const nextPrice = toNum(p, 1);
    setPrice(nextPrice);

    (async () => {
      try {
        if (!isDemo) {
          const token = getAccessToken();
          if (!token) {
            navigate(`/login?redirect=${encodeURIComponent(`/task?price=${nextPrice}`)}`);
            return;
          }
        }

        await startTask(nextPrice);
      } catch (e) {
        const msg = e?.message ? e.message : String(e);
        console.error("START_ERROR =", msg);
        setBootError(msg);
        setPhase("loading");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  /* ===============================
     drag & drop
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
     click-to-place
  ================================ */
  const onPickClick = (num) => {
    if (submitting) return;
    setSelectedPick((prev) => (prev === num ? null : num));
  };

  const onSlotClick = (i) => {
    if (submitting) return;
    if (selectedPick == null) return;
    const next = [...orderedNumbers];
    next[i] = selectedPick;
    setOrderedNumbers(next);
    setSelectedPick(null);
  };

  const onReset = () => {
    setOrderedNumbers(Array(10).fill(null));
    setSelectedPick(null);
    setStartTime(Date.now());
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
     UI
  ================================ */
  if (phase === "loading" && !bootError) {
    return (
      <div className="min-h-screen bg-white font-inter flex items-center justify-center">
        <div className="text-[14px] text-[#7A7A7A]">Loading...</div>
      </div>
    );
  }

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
              onClick={() => navigate("/balance")}
              className="flex-1 h-[48px] border border-[#E5E5E5] rounded-lg text-[14px] font-medium text-[#7A7A7A] hover:border-[#2563FF] hover:text-[#2563FF]"
            >
              Back
            </button>
            <button
              onClick={async () => {
                try {
                  setBootError("");
                  await startTask();
                } catch (e) {
                  const msg = e?.message ?? String(e);
                  if (!isDemo && msg.includes("missing taskdash_access_token")) {
                    navigate(`/login?redirect=${encodeURIComponent(`/task?price=${price}`)}`);
                    return;
                  }
                  setBootError(msg);
                }
              }}
              className="flex-1 h-[48px] bg-[#2563FF] text-white text-[14px] font-semibold rounded-lg"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-inter">
      <div className="border-b border-[#EDEDED]">
        <div className="max-w-[800px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-4 border-[#2563FF] rounded-full" />
            <span className="text-[16px] font-semibold text-[#2B2B2B]">
              Task Dash
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isDemo && (
              <div className="px-3 py-2 rounded-lg bg-[#EFF6FF] text-[#2563FF] text-[12px] font-semibold">
                DEMO MODE
              </div>
            )}

            <button
              onClick={() => setShowResetModal(true)}
              disabled={submitting}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-[#E5E5E5] text-[#2B2B2B] text-[13px] font-semibold rounded-lg hover:border-[#2563FF] disabled:opacity-50"
            >
              <RefreshCw size={16} />
              Reset
            </button>

            <a
              href="/rules"
              className="flex items-center gap-2 px-3 py-2 border border-[#E5E5E5] rounded-lg text-[13px] font-semibold text-[#7A7A7A] hover:border-[#2563FF] hover:text-[#2563FF]"
            >
              <BookOpen size={16} />
              Rules
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-[800px] mx-auto px-6 py-8">
        <div className="bg-white border border-[#F1F1F1] rounded-xl p-8 mb-6">
          <div className="flex items-start justify-between gap-6 mb-6">
            <div className="flex-1">
              <div className="text-[13px] text-[#7A7A7A] mb-1">
                Arrange Numbers
              </div>
              <div className="text-[24px] font-semibold text-[#2B2B2B]">
                Fill all 10 slots
              </div>
              <div className="text-[12px] text-[#7A7A7A] mt-1">
                Price:{" "}
                <span className="font-semibold text-[#2B2B2B]">
                  ${toNum(price, 1)}
                </span>{" "}
                · Progress:{" "}
                <span className="font-semibold text-[#2B2B2B]">
                  {filledCount}/10
                </span>
              </div>
              <div className="text-[12px] text-[#7A7A7A] mt-1">
                attemptId:{" "}
                <span className="font-mono text-[#2B2B2B]">{attemptId}</span>
              </div>
            </div>

            <div className="text-right">
              {submitting ? (
                <div className="text-[13px] font-semibold text-[#2563FF]">
                  Submitting...
                </div>
              ) : selectedPick != null ? (
                <div className="text-[13px] font-semibold text-[#10B981]">
                  Selected: {selectedPick}
                </div>
              ) : (
                <div className="text-[13px] text-[#7A7A7A]">
                  Click a number, then click a slot
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2 mb-6">
            {orderedNumbers.map((num, i) => {
              const has = num != null;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSlotClick(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(i)}
                  disabled={submitting}
                  className={`h-[60px] rounded-lg text-[18px] font-semibold transition-all relative border-2 ${
                    has
                      ? "bg-white text-[#2B2B2B] border-[#2563FF]"
                      : selectedPick != null
                      ? "bg-[#EFF6FF] text-[#2B2B2B] border-[#2563FF] hover:bg-[#E8F0FF]"
                      : "bg-white text-[#2B2B2B] border-[#E5E5E5] hover:border-[#2563FF]"
                  } ${submitting ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  {has ? num : i + 1}
                  {!has && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#9B9B9B] rounded-full flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">
                        {i + 1}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mb-3">
            <div className="text-[14px] font-medium text-[#2B2B2B] mb-3">
              Numbers
            </div>

            <div className="grid grid-cols-5 gap-2">
              {numbers.map((num, i) => {
                const active = selectedPick === num;
                return (
                  <button
                    key={i}
                    type="button"
                    draggable={!submitting}
                    onDragStart={() => handleDragStart(i)}
                    onClick={() => onPickClick(num)}
                    disabled={submitting}
                    className={`h-[60px] rounded-lg text-[18px] font-semibold transition-all relative border-2 ${
                      active
                        ? "bg-[#2563FF] text-white border-2 border-[#2563FF]"
                        : "bg-white text-[#2B2B2B] border-2 border-[#E5E5E5] hover:border-[#2563FF]"
                    } ${submitting ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      <GripVertical
                        size={14}
                        className={active ? "opacity-80" : "opacity-50"}
                      />
                      {num}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-[12px] text-[#7A7A7A] mt-4">
            Tip: Drag &amp; drop also works.
          </p>
        </div>

        <a
          href="/balance"
          className="w-full h-[48px] border border-[#E5E5E5] rounded-lg text-[14px] font-medium text-[#7A7A7A] flex items-center justify-center gap-2 hover:border-[#2563FF] hover:text-[#2563FF]"
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
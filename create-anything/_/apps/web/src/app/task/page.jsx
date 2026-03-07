"use client";

import { useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
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

function makeDemoAttemptId() {
  return `demo-attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeDemoNumbers(count = 10) {
  const set = new Set();
  while (set.size < count) {
    set.add(Math.floor(Math.random() * 900) + 100);
  }
  return Array.from(set);
}

function getAttemptIdFromStart(data) {
  return String(data?.attempt?.id || data?.attemptId || data?.id || "");
}

function getNumbersFromStart(data) {
  const nums = data?.attempt?.numbers ?? data?.numbers;
  return Array.isArray(nums) ? nums : [];
}

function getAttemptIdFromSubmit(data, fallbackAttemptId) {
  return String(
    data?.attempt?.id ||
      data?.attemptId ||
      data?.id ||
      data?.attempt?.attemptId ||
      fallbackAttemptId ||
      ""
  );
}

/* ===============================
   TaskPage
================================ */
export default function TaskPage() {
  const [attemptId, setAttemptId] = useState(null);
  const [priceUsd, setPriceUsd] = useState(1);

  const [numbers, setNumbers] = useState([]);
  const [orderedNumbers, setOrderedNumbers] = useState(new Array(10).fill(null));

  const [submitting, setSubmitting] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const intervalRef = useRef(null);
  const draggedRef = useRef(null);

  const [phase, setPhase] = useState("warmup"); // warmup | countdown | task | submitting
  const [countdown, setCountdown] = useState(10);
  const [bootError, setBootError] = useState("");

  const isDemo = rtIsDemoMode();

  const [practiceNumbers] = useState([45, 23, 89, 12, 67, 34, 91, 56, 78, 29]);
  const [practiceOrdered, setPracticeOrdered] = useState(new Array(10).fill(null));
  const practiceDraggedRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const price = sp.get("price");
    setPriceUsd(toNum(price, 1));
  }, []);

  /* ===============================
     countdown
  ================================ */
  useEffect(() => {
    if (phase !== "countdown") return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }

    setPhase("task");
    setStartTime(Date.now());
    setElapsedTime(0);
  }, [phase, countdown]);

  /* ===============================
     timer
  ================================ */
  useEffect(() => {
    if (phase === "task" && startTime) {
      intervalRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 10);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [startTime, phase]);

  /* ===============================
     start task
  ================================ */
  const loadRealTask = async () => {
    if (isDemo) {
      const demoAttemptId = makeDemoAttemptId();
      const demoNumbers = makeDemoNumbers(10);
      setAttemptId(demoAttemptId);
      setNumbers(demoNumbers);
      setOrderedNumbers(new Array(10).fill(null));
      return;
    }

    const token = getAccessToken();
    if (!token) {
      navigate(`/login?redirect=${encodeURIComponent(`/task?price=${priceUsd}`)}`);
      return false;
    }

    const response = await authenticatedFetch("/api/tasks/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: priceUsd }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data?.ok === false) {
      throw new Error(data?.error || "Failed to start task");
    }

    const newAttemptId = getAttemptIdFromStart(data);
    const nums = getNumbersFromStart(data);

    if (!newAttemptId) throw new Error("start: missing attempt.id");
    if (!Array.isArray(nums) || nums.length !== 10) {
      throw new Error("start: numbers missing (need 10)");
    }

    setAttemptId(newAttemptId);
    setNumbers(nums);
    setOrderedNumbers(new Array(10).fill(null));
    return true;
  };

  const handleReadyForReal = async () => {
    try {
      setBootError("");
      const ok = await loadRealTask();
      if (ok === false) return;
      setCountdown(10);
      setPhase("countdown");
    } catch (error) {
      setBootError(error?.message || String(error));
    }
  };

  /* ===============================
     auto submit
  ================================ */
  useEffect(() => {
    if (
      phase === "task" &&
      orderedNumbers.every((n) => n !== null) &&
      !submitting &&
      attemptId
    ) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedNumbers, phase, attemptId]);

  /* ===============================
     drag / drop
================================ */
  const handleDragStart = (index, fromSource = true) => {
    draggedRef.current = { index, fromSource };
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDropToSlot = (targetIndex) => {
    if (!draggedRef.current) return;

    if (phase === "task" && orderedNumbers.every((n) => n !== null)) {
      return;
    }

    const next = [...orderedNumbers];

    if (draggedRef.current.fromSource) {
      next[targetIndex] = numbers[draggedRef.current.index];
    } else {
      const srcIndex = draggedRef.current.index;
      const temp = next[targetIndex];
      next[targetIndex] = next[srcIndex];
      next[srcIndex] = temp;
    }

    setOrderedNumbers(next);
    draggedRef.current = null;
  };

  /* ===============================
     practice drag / drop
================================ */
  const handlePracticeDragStart = (index, fromSource = true) => {
    practiceDraggedRef.current = { index, fromSource };
  };

  const handlePracticeDropToSlot = (targetIndex) => {
    if (!practiceDraggedRef.current) return;

    const next = [...practiceOrdered];

    if (practiceDraggedRef.current.fromSource) {
      next[targetIndex] = practiceNumbers[practiceDraggedRef.current.index];
    } else {
      const srcIndex = practiceDraggedRef.current.index;
      const temp = next[targetIndex];
      next[targetIndex] = next[srcIndex];
      next[srcIndex] = temp;
    }

    setPracticeOrdered(next);
    practiceDraggedRef.current = null;
  };

  /* ===============================
     submit
  ================================ */
  const handleSubmit = async () => {
    if (orderedNumbers.some((n) => n === null)) return;

    setSubmitting(true);
    const timeMs = Math.max(0, Date.now() - (startTime || Date.now()));

    try {
      if (isDemo) {
        const demoData = {
          ok: true,
          mode: "demo",
          status: "matched",
          result: "demo",
          attemptId,
          timeMs,
          elapsedMs: timeMs,
          durationMs: timeMs,
          orderedNumbers,
          numbers,
          priceUsd,
        };

        navigate(`/results?data=${encodeURIComponent(JSON.stringify(demoData))}`);
        return;
      }

      const response = await authenticatedFetch("/api/tasks/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attemptId,
          orderedNumbers,
          numbers: orderedNumbers,
          timeMs,
          elapsedMs: timeMs,
          durationMs: timeMs,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || "Failed to submit");
      }

      const idForResult = getAttemptIdFromSubmit(data, attemptId);

      if (data?.status === "waiting") {
        navigate(`/results?data=${encodeURIComponent(JSON.stringify(data))}`);
        return;
      }

      if (idForResult) {
        navigate(`/results?data=${encodeURIComponent(JSON.stringify(data))}`);
        return;
      }

      navigate(`/results?data=${encodeURIComponent(JSON.stringify(data))}`);
    } catch (error) {
      alert(error?.message || String(error));
      setSubmitting(false);
    }
  };

  /* ===============================
     error
  ================================ */
  if (bootError) {
    return (
      <div className="min-h-screen bg-white font-inter flex items-center justify-center p-6">
        <div className="max-w-[720px] w-full border border-[#F1F1F1] rounded-xl p-6">
          <div className="text-[16px] font-semibold text-[#2B2B2B] mb-2">Error</div>
          <pre className="text-[12px] text-[#C33] whitespace-pre-wrap">{bootError}</pre>

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => {
                setBootError("");
                setPhase("warmup");
              }}
              className="flex-1 h-[48px] border border-[#E5E5E5] rounded-lg text-[14px] font-medium text-[#7A7A7A]"
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
     warmup
  ================================ */
  if (phase === "warmup") {
    return (
      <div className="min-h-screen bg-white font-inter">
        <div className="border-b border-[#EDEDED]">
          <div className="max-w-[800px] mx-auto px-6 h-[64px] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 border-4 border-[#2563FF] rounded-full"></div>
              <span className="text-[16px] font-semibold text-[#2B2B2B]">
                Task Dash {priceUsd ? `- $${priceUsd}` : ""}
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
                • <strong>No changes after:</strong> You can rearrange while
                solving, but once final slot is filled it submits
              </li>
              <li>
                • <strong>Speed matters:</strong> Faster + accurate = better
                rewards
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
                    onDragOver={handleDragOver}
                    onDrop={() => handlePracticeDropToSlot(index)}
                    className={`h-[80px] border-2 border-dashed rounded-lg flex items-center justify-center text-[24px] font-semibold ${
                      num === null
                        ? "border-[#E5E5E5] bg-[#FAFAFA] text-[#C3C3C3]"
                        : "border-[#10B981] bg-[#ECFDF5] text-[#10B981] cursor-move"
                    }`}
                    draggable={num !== null}
                    onDragStart={() =>
                      num !== null && handlePracticeDragStart(index, false)
                    }
                  >
                    {num === null ? index + 1 : num}
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
                    onDragStart={() => handlePracticeDragStart(index, true)}
                    className="h-[80px] bg-white border-2 border-[#E5E5E5] rounded-lg flex items-center justify-center text-[24px] font-semibold text-[#2B2B2B] cursor-move hover:border-[#10B981] hover:bg-[#F8FAFC]"
                  >
                    <GripVertical size={16} className="text-[#C3C3C3] mr-2" />
                    {num}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-[#EDEDED]">
              <button
                onClick={handleReadyForReal}
                className="w-full h-[56px] bg-[#10B981] text-white text-[16px] font-semibold rounded-lg hover:bg-[#059669]"
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
     countdown
  ================================ */
  if (phase === "countdown") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2563FF] to-[#1E40AF] font-inter flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-[120px] font-bold mb-6">{countdown}</div>
          <div className="text-[24px] text-blue-100 font-medium">Get Ready...</div>
        </div>
      </div>
    );
  }

  /* ===============================
     task
  ================================ */
  return (
    <div className="min-h-screen bg-white font-inter">
      <div className="border-b border-[#EDEDED]">
        <div className="max-w-[800px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-4 border-[#2563FF] rounded-full"></div>
            <span className="text-[16px] font-semibold text-[#2B2B2B]">
              Task Dash {priceUsd ? `- $${priceUsd}` : ""}
            </span>
          </div>

          <div className="text-[20px] font-mono font-semibold text-[#2563FF]">
            {(elapsedTime / 1000).toFixed(2)}s
          </div>
        </div>
      </div>

      <div className="max-w-[800px] mx-auto px-6 py-8">
        <div className="bg-white border border-[#F1F1F1] rounded-xl p-8">
          <h1 className="text-[20px] font-semibold text-[#2B2B2B] mb-2">
            Sort Numbers in Descending Order
          </h1>
          <p className="text-[14px] text-[#7A7A7A] mb-8">
            Drag numbers from the pool below into the slots. Auto-submits when
            all slots are filled.
          </p>

          <div className="text-[12px] text-[#7A7A7A] mb-6">
            attemptId:{" "}
            <span className="font-mono text-[#2B2B2B]">{attemptId}</span>
          </div>

          <div className="mb-8">
            <div className="text-[13px] font-medium text-[#2B2B2B] mb-3">
              Your Answer:
            </div>
            <div className="grid grid-cols-5 gap-3">
              {orderedNumbers.map((num, index) => (
                <div
                  key={index}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDropToSlot(index)}
                  className={`h-[80px] border-2 border-dashed rounded-lg flex items-center justify-center text-[24px] font-semibold ${
                    num === null
                      ? "border-[#E5E5E5] bg-[#FAFAFA] text-[#C3C3C3]"
                      : "border-[#2563FF] bg-[#EFF6FF] text-[#2563FF] cursor-move"
                  }`}
                  draggable={num !== null && !submitting}
                  onDragStart={() =>
                    num !== null && !submitting && handleDragStart(index, false)
                  }
                >
                  {num === null ? index + 1 : num}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[13px] font-medium text-[#2B2B2B] mb-3">
              Number Pool:
            </div>
            <div className="grid grid-cols-5 gap-3">
              {numbers.map((num, index) => (
                <div
                  key={index}
                  draggable={!submitting}
                  onDragStart={() => !submitting && handleDragStart(index, true)}
                  className="h-[80px] bg-white border-2 border-[#E5E5E5] rounded-lg flex items-center justify-center text-[24px] font-semibold text-[#2B2B2B] cursor-move hover:border-[#2563FF] hover:bg-[#F8FAFC]"
                >
                  <GripVertical size={16} className="text-[#C3C3C3] mr-2" />
                  {num}
                </div>
              ))}
            </div>
          </div>

          {submitting && (
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
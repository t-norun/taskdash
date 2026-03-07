"use client";

import { useState, useEffect, useRef } from "react";
import { navigate, getQueryParam } from "@/utils/navigation";
import { GripVertical } from "lucide-react";
import { authenticatedFetch } from "@/utils/auth";

export default function TaskPage() {
  const [attemptId, setAttemptId] = useState("");
  const [priceUsd, setPriceUsd] = useState(null);

  const [numbers, setNumbers] = useState([]);
  const [orderedNumbers, setOrderedNumbers] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [loadingTask, setLoadingTask] = useState(true);
  const [taskError, setTaskError] = useState("");

  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef(null);

  const [phase, setPhase] = useState("warmup");
  const [countdown, setCountdown] = useState(10);

  const [practiceNumbers] = useState([45, 23, 89, 12, 67, 34, 91, 56, 78, 29]);
  const [practiceOrdered, setPracticeOrdered] = useState(new Array(10).fill(null));

  const [waitingForMatch, setWaitingForMatch] = useState(false);
  const [waitingSubmissionId, setWaitingSubmissionId] = useState(null);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    const aid = getQueryParam("attemptId") || getQueryParam("id") || "";
    const price = getQueryParam("price");

    if (!aid || !price) {
      setTaskError("Missing attemptId or price in task URL.");
      setLoadingTask(false);
      return;
    }

    setAttemptId(String(aid));
    setPriceUsd(parseFloat(price));
  }, []);

  useEffect(() => {
    if (attemptId && phase === "warmup") {
      loadTask();
    }
  }, [attemptId, phase]);

  useEffect(() => {
    if (phase === "countdown" && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }

    if (phase === "countdown" && countdown === 0) {
      setPhase("task");
      setStartTime(Date.now());
    }
  }, [phase, countdown]);

  useEffect(() => {
    if (startTime && phase === "task") {
      intervalRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 10);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [startTime, phase]);

  useEffect(() => {
    if (phase === "task" && orderedNumbers.every((n) => n !== null) && !submitting) {
      handleSubmit();
    }
  }, [orderedNumbers, phase, submitting]);

  useEffect(() => {
    if (waitingForMatch && waitingSubmissionId) {
      pollIntervalRef.current = setInterval(() => {
        checkMatchStatus();
      }, 3000);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [waitingForMatch, waitingSubmissionId]);

  const loadTask = async () => {
    setLoadingTask(true);
    setTaskError("");

    try {
      const response = await authenticatedFetch("/api/tasks/current");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load task");
      }

      if (!Array.isArray(data?.numbers) || data.numbers.length !== 10) {
        throw new Error("Task numbers were not returned correctly.");
      }

      setNumbers(data.numbers);
      setOrderedNumbers(new Array(10).fill(null));
    } catch (error) {
      console.error("loadTask failed:", error);
      setTaskError(error?.message || "Failed to load task.");
    } finally {
      setLoadingTask(false);
    }
  };

  const handleDragStart = (e, index, fromSource = true) => {
    e.dataTransfer.effectAllowed = "move";
    setDraggedIndex({ index, fromSource });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropToSlot = (e, targetIndex) => {
    e.preventDefault();

    if (draggedIndex === null) return;

    if (phase === "task" && orderedNumbers.every((n) => n !== null)) {
      return;
    }

    const isWarmup = phase === "warmup";
    const currentOrdered = isWarmup ? [...practiceOrdered] : [...orderedNumbers];

    if (draggedIndex.fromSource) {
      const sourceNumbers = isWarmup ? practiceNumbers : numbers;
      currentOrdered[targetIndex] = sourceNumbers[draggedIndex.index];
    } else {
      const temp = currentOrdered[targetIndex];
      currentOrdered[targetIndex] = currentOrdered[draggedIndex.index];
      currentOrdered[draggedIndex.index] = temp;
    }

    if (isWarmup) {
      setPracticeOrdered(currentOrdered);
    } else {
      setOrderedNumbers(currentOrdered);
    }

    setDraggedIndex(null);
  };

  const handleReadyForReal = () => {
    if (taskError) return;
    setPhase("countdown");
    setCountdown(10);
  };

  const handleSubmit = async () => {
    if (!attemptId) return;
    if (!startTime) return;
    if (orderedNumbers.some((n) => n === null)) return;

    setSubmitting(true);
    const timeMs = Date.now() - startTime;

    try {
      const response = await authenticatedFetch("/api/tasks/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attemptId,
          orderedNumbers,
          timeMs,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to submit");
      }

      if (data?.status === "waiting") {
        setWaitingForMatch(true);
        setWaitingSubmissionId(data?.submissionId ?? null);
        setPhase("waiting");
        return;
      }

      navigate(`/results?data=${encodeURIComponent(JSON.stringify(data))}`);
    } catch (error) {
      alert(error?.message || "Failed to submit");
      setSubmitting(false);
    }
  };

  const checkMatchStatus = async () => {
    if (!waitingSubmissionId) return;

    try {
      const response = await authenticatedFetch(
        `/api/tasks/check-match?submissionId=${encodeURIComponent(String(waitingSubmissionId))}`,
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to check match");
      }

      if (data?.status === "matched") {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        navigate(`/results?data=${encodeURIComponent(JSON.stringify(data))}`);
        return;
      }

      if (data?.status === "timeout") {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        navigate(
          `/results?data=${encodeURIComponent(
            JSON.stringify({
              status: "timeout",
              message: data?.message,
            }),
          )}`,
        );
      }
    } catch (error) {
      console.error("Failed to check match:", error);
    }
  };

  if (taskError) {
    return (
      <div className="min-h-screen bg-white font-inter">
        <div className="mx-auto max-w-[800px] px-6 py-16">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <h1 className="mb-2 text-[20px] font-semibold text-red-700">Task load failed</h1>
            <p className="mb-4 text-[14px] text-red-600">{taskError}</p>
            <div className="flex gap-3">
              <button
                onClick={loadTask}
                className="rounded-lg bg-[#2563FF] px-4 py-2 text-white"
              >
                Retry
              </button>
              <button
                onClick={() => navigate("/")}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700"
              >
                Back Home
              </button>
            </div>
            <div className="mt-4 text-[12px] text-gray-500">
              attemptId: {attemptId || "(none)"} / price: {String(priceUsd ?? "")}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "warmup") {
    return (
      <div className="min-h-screen bg-white font-inter">
        <div className="border-b border-[#EDEDED]">
          <div className="mx-auto flex h-[64px] max-w-[800px] items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full border-4 border-[#2563FF]"></div>
              <span className="text-[16px] font-semibold text-[#2B2B2B]">
                Task Dash {priceUsd != null && `- $${priceUsd}`}
              </span>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[800px] px-6 py-8">
          {loadingTask && (
            <div className="mb-6 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] p-4 text-[#1D4ED8]">
              Loading task...
            </div>
          )}

          <div className="mb-6 rounded-xl border border-[#F59E0B] bg-[#FEF3C7] p-6">
            <h2 className="mb-3 text-[18px] font-semibold text-[#92400E]">📋 Task Rules</h2>
            <ul className="space-y-2 text-[14px] text-[#78350F]">
              <li>• <strong>Goal:</strong> Sort 10 numbers in descending order (largest → smallest)</li>
              <li>• <strong>Method:</strong> Drag numbers from the pool into all 10 slots</li>
              <li>• <strong>Important:</strong> Once all slots are filled, the task auto-submits immediately</li>
              <li>• <strong>No changes after:</strong> You cannot rearrange numbers after all slots are filled</li>
              <li>• <strong>Speed matters:</strong> Faster + accurate = better rewards</li>
            </ul>
          </div>

          <div className="rounded-xl border border-[#F1F1F1] bg-white p-8">
            <h3 className="mb-2 text-[18px] font-semibold text-[#2B2B2B]">Practice Here</h3>
            <p className="mb-6 text-[14px] text-[#7A7A7A]">
              Try sorting these practice numbers. This won&apos;t affect your score.
            </p>

            <div className="mb-8">
              <div className="mb-3 text-[13px] font-medium text-[#2B2B2B]">Your Practice Answer:</div>
              <div className="grid grid-cols-5 gap-3">
                {practiceOrdered.map((num, index) => (
                  <div
                    key={index}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropToSlot(e, index)}
                    className={`flex h-[80px] items-center justify-center rounded-lg border-2 border-dashed text-[24px] font-semibold ${
                      num === null
                        ? "border-[#E5E5E5] bg-[#FAFAFA] text-[#C3C3C3]"
                        : "cursor-move border-[#10B981] bg-[#ECFDF5] text-[#10B981]"
                    }`}
                    draggable={num !== null}
                    onDragStart={(e) => num !== null && handleDragStart(e, index, false)}
                  >
                    {num === null ? index + 1 : num}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 text-[13px] font-medium text-[#2B2B2B]">Practice Number Pool:</div>
              <div className="grid grid-cols-5 gap-3">
                {practiceNumbers.map((num, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index, true)}
                    className="flex h-[80px] cursor-move items-center justify-center rounded-lg border-2 border-[#E5E5E5] bg-white text-[24px] font-semibold text-[#2B2B2B] hover:border-[#10B981] hover:bg-[#F8FAFC]"
                  >
                    <GripVertical size={16} className="mr-2 text-[#C3C3C3]" />
                    {num}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 border-t border-[#EDEDED] pt-6">
              <button
                onClick={handleReadyForReal}
                disabled={loadingTask}
                className="h-[56px] w-full rounded-lg bg-[#10B981] text-[16px] font-semibold text-white hover:bg-[#059669] disabled:opacity-50"
              >
                Ready for Real Task →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "countdown") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#2563FF] to-[#1E40AF] font-inter">
        <div className="text-center">
          <div className="mb-6 text-[120px] font-bold text-white">{countdown}</div>
          <div className="text-[24px] font-medium text-blue-100">Get Ready...</div>
        </div>
      </div>
    );
  }

  if (phase === "waiting") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#2563FF] to-[#1E40AF] font-inter">
        <div className="text-center">
          <div className="mx-auto mb-6 h-16 w-16 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
          <div className="mb-2 text-[24px] font-semibold text-white">Waiting for Opponent...</div>
          <div className="text-[16px] text-blue-100">Looking for a match at ${priceUsd}</div>
          <div className="mt-4 text-[14px] text-blue-200">Your time: {(elapsedTime / 1000).toFixed(2)}s</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-inter">
      <div className="border-b border-[#EDEDED]">
        <div className="mx-auto flex h-[64px] max-w-[800px] items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full border-4 border-[#2563FF]"></div>
            <span className="text-[16px] font-semibold text-[#2B2B2B]">
              Task Dash {priceUsd != null && `- $${priceUsd}`}
            </span>
          </div>

          <div className="text-[20px] font-mono font-semibold text-[#2563FF]">
            {(elapsedTime / 1000).toFixed(2)}s
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[800px] px-6 py-8">
        <div className="rounded-xl border border-[#F1F1F1] bg-white p-8">
          <h1 className="mb-2 text-[20px] font-semibold text-[#2B2B2B]">
            Sort Numbers in Descending Order
          </h1>
          <p className="mb-8 text-[14px] text-[#7A7A7A]">
            Drag numbers from the pool below into the slots. Auto-submits when all slots are filled.
          </p>

          <div className="mb-8">
            <div className="mb-3 text-[13px] font-medium text-[#2B2B2B]">Your Answer:</div>
            <div className="grid grid-cols-5 gap-3">
              {orderedNumbers.map((num, index) => (
                <div
                  key={index}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropToSlot(e, index)}
                  className={`flex h-[80px] items-center justify-center rounded-lg border-2 border-dashed text-[24px] font-semibold ${
                    num === null
                      ? "border-[#E5E5E5] bg-[#FAFAFA] text-[#C3C3C3]"
                      : "cursor-move border-[#2563FF] bg-[#EFF6FF] text-[#2563FF]"
                  }`}
                  draggable={num !== null && !submitting}
                  onDragStart={(e) =>
                    num !== null && !submitting && handleDragStart(e, index, false)
                  }
                >
                  {num === null ? index + 1 : num}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 text-[13px] font-medium text-[#2B2B2B]">Number Pool:</div>
            <div className="grid grid-cols-5 gap-3">
              {numbers.map((num, index) => (
                <div
                  key={index}
                  draggable={!submitting}
                  onDragStart={(e) => !submitting && handleDragStart(e, index, true)}
                  className="flex h-[80px] cursor-move items-center justify-center rounded-lg border-2 border-[#E5E5E5] bg-white text-[24px] font-semibold text-[#2B2B2B] hover:border-[#2563FF] hover:bg-[#F8FAFC]"
                >
                  <GripVertical size={16} className="mr-2 text-[#C3C3C3]" />
                  {num}
                </div>
              ))}
            </div>
          </div>

          {submitting && (
            <div className="mt-8 border-t border-[#EDEDED] pt-6">
              <div className="text-center text-[16px] font-semibold text-[#2563FF]">
                Submitting...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
"use client";

import { useState, useEffect, useRef } from "react";
import { navigate, getQueryParam } from "@/utils/navigation";
import { GripVertical } from "lucide-react";
import {
  getCurrent,
  submitTask,
  checkMatch,
  isDemoMode as rtIsDemoMode,
} from "@/utils/runtimeData";

function makeDemoNumbers() {
  const arr = [];
  while (arr.length < 10) {
    arr.push(Math.floor(Math.random() * 90) + 10);
  }
  return arr;
}

export default function TaskPage() {
  const [taskId, setTaskId] = useState(null);
  const [priceUsd, setPriceUsd] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [orderedNumbers, setOrderedNumbers] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [submitting, setSubmitting] = useState(false);
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

  const isDemo = rtIsDemoMode();

  useEffect(() => {
    const attemptId = getQueryParam("attemptId") || getQueryParam("id");
    const price = Number(getQueryParam("price"));
    const safePrice = Number.isFinite(price) && price > 0 ? price : 1;

    setPriceUsd(safePrice);

    if (!attemptId) {
      navigate("/");
      return;
    }

    setTaskId(attemptId);
  }, []);

  useEffect(() => {
    if (taskId && phase === "warmup") {
      loadTask();
    }
  }, [taskId, phase]);

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
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startTime, phase]);

  useEffect(() => {
    if (
      phase === "task" &&
      orderedNumbers.every((n) => n !== null) &&
      !submitting
    ) {
      handleSubmit();
    }
  }, [orderedNumbers, phase, submitting]);

  useEffect(() => {
    if (waitingForMatch && waitingSubmissionId) {
      pollIntervalRef.current = setInterval(async () => {
        await checkMatchStatus();
      }, 800);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [waitingForMatch, waitingSubmissionId]);

  const loadTask = async () => {
    try {
      const current = await getCurrent(taskId);

      if (!current?.ok) {
        throw new Error(current?.error || "Failed to load task");
      }

      if (isDemo) {
        setNumbers(makeDemoNumbers());
        setOrderedNumbers(new Array(10).fill(null));
        return;
      }

      const taskNumbers = Array.isArray(current?.task?.numbers)
        ? current.task.numbers
        : Array.isArray(current?.numbers)
          ? current.numbers
          : [];

      if (!Array.isArray(taskNumbers) || taskNumbers.length !== 10) {
        throw new Error("Invalid task data");
      }

      setNumbers(taskNumbers);
      setOrderedNumbers(new Array(10).fill(null));
    } catch (error) {
      alert(error?.message || "Failed to load task");
      navigate("/");
    }
  };

  const handleDragStart = (e, index, fromSource = true) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    setDraggedIndex({ index, fromSource });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropToSlot = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null) return;

    if (phase === "task" && orderedNumbers.every((n) => n !== null)) return;

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

    if (isWarmup) setPracticeOrdered(currentOrdered);
    else setOrderedNumbers(currentOrdered);

    setDraggedIndex(null);
  };

  const handleReadyForReal = () => {
    setPhase("countdown");
    setCountdown(10);
  };

  const handleSubmit = async () => {
    if (orderedNumbers.some((n) => n === null)) return;
    if (!startTime) return;

    setSubmitting(true);
    const timeMs = Date.now() - startTime;

    try {
      const data = await submitTask({
        attemptId: taskId,
        priceUsd,
        orderedNumbers,
        timeMs,
      });

      if (!data?.ok) {
        throw new Error(data?.error || "Failed to submit");
      }

      if (data.statusCompat === "waiting" || data.status === "submitted") {
        setWaitingForMatch(true);
        setWaitingSubmissionId(data.submissionId);
        setPhase("waiting");
      } else {
        navigate(`/results?data=${encodeURIComponent(JSON.stringify(data))}`);
      }
    } catch (error) {
      alert(error?.message || "Failed to submit");
      setSubmitting(false);
    }
  };

  const checkMatchStatus = async () => {
    try {
      const data = await checkMatch(waitingSubmissionId);

      if (!data?.ok) {
        throw new Error(data?.error || "Failed to check match");
      }

      if (data.statusCompat === "matched") {
        clearInterval(pollIntervalRef.current);

        let resultPayload = data;

        if (isDemo && data.demoMatch) {
          resultPayload = {
            mode: "demo",
            status: "matched",
            result: data.demoMatch.outcome,
            priceUsd: data.demoMatch.priceUsd,
            payout: (data.demoMatch.userPayoutCents || 0) / 100,
            newBalance: undefined,
            yourTimeMs: data.demoMatch.player?.timeMs ?? null,
            opponentTimeMs: data.demoMatch.cpu?.timeMs ?? null,
            playerScore: data.demoMatch.player?.score,
            cpuScore: data.demoMatch.cpu?.score,
            cpuName: data.demoMatch.cpu?.name || "CPU",
            deltaUsd: data.demoMatch.deltaUsd,
            platformFeeUsd: (data.demoMatch.platformFeeCents || 0) / 100,
            submissionId: data.submissionId,
            matchId: data.matchId,
            demoMatch: data.demoMatch,
          };
        }

        navigate(`/results?data=${encodeURIComponent(JSON.stringify(resultPayload))}`);
      }
    } catch (error) {
      console.error("Failed to check match:", error);
    }
  };

  if (phase === "warmup") {
    return (
      <div className="min-h-screen bg-white font-inter">
        <div className="border-b border-[#EDEDED]">
          <div className="max-w-[800px] mx-auto px-6 h-[64px] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 border-4 border-[#2563FF] rounded-full" />
              <span className="text-[16px] font-semibold text-[#2B2B2B]">
                Task Dash {priceUsd && `- $${priceUsd}`} {isDemo ? "(Demo)" : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-[800px] mx-auto px-6 py-8">
          <div className="bg-[#FEF3C7] border border-[#F59E0B] rounded-xl p-6 mb-6">
            <h2 className="text-[18px] font-semibold text-[#92400E] mb-3">
              Task Rules
            </h2>
            <ul className="space-y-2 text-[14px] text-[#78350F]">
              <li>• <strong>Goal:</strong> Sort 10 numbers in descending order (largest → smallest)</li>
              <li>• <strong>Method:</strong> Drag numbers from the pool into all 10 slots</li>
              <li>• <strong>Important:</strong> Once all slots are filled, the task auto-submits immediately</li>
              <li>• <strong>No changes after:</strong> You cannot rearrange numbers after all slots are filled</li>
              <li>• <strong>Speed matters:</strong> Faster + accurate = better rewards</li>
              <li>• <strong>Demo:</strong> In demo mode, matching is handled by local CPU logic</li>
            </ul>
          </div>

          <div className="bg-white border border-[#F1F1F1] rounded-xl p-8">
            <h3 className="text-[18px] font-semibold text-[#2B2B2B] mb-2">
              Practice Here
            </h3>
            <p className="text-[14px] text-[#7A7A7A] mb-6">
              Try sorting these practice numbers. This won&apos;t affect your score.
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
                    onDrop={(e) => handleDropToSlot(e, index)}
                    className={`h-[80px] border-2 border-dashed rounded-lg flex items-center justify-center text-[24px] font-semibold ${
                      num === null
                        ? "border-[#E5E5E5] bg-[#FAFAFA] text-[#C3C3C3]"
                        : "border-[#10B981] bg-[#ECFDF5] text-[#10B981] cursor-move"
                    }`}
                    draggable={num !== null}
                    onDragStart={(e) =>
                      num !== null && handleDragStart(e, index, false)
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
                    onDragStart={(e) => handleDragStart(e, index, true)}
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
                Ready for Task →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

  if (phase === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2563FF] to-[#1E40AF] font-inter flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <div className="text-[24px] text-white font-semibold mb-2">
            Waiting for {isDemo ? "CPU Match..." : "Opponent..."}
          </div>
          <div className="text-[16px] text-blue-100">
            Processing at ${priceUsd}
          </div>
          <div className="text-[14px] text-blue-200 mt-4">
            Your time: {(elapsedTime / 1000).toFixed(2)}s
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
              Task Dash {priceUsd && `- $${priceUsd}`} {isDemo ? "(Demo)" : ""}
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

          <div className="mb-8">
            <div className="text-[13px] font-medium text-[#2B2B2B] mb-3">
              Your Answer:
            </div>
            <div className="grid grid-cols-5 gap-3">
              {orderedNumbers.map((num, index) => (
                <div
                  key={index}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropToSlot(e, index)}
                  className={`h-[80px] border-2 border-dashed rounded-lg flex items-center justify-center text-[24px] font-semibold ${
                    num === null
                      ? "border-[#E5E5E5] bg-[#FAFAFA] text-[#C3C3C3]"
                      : "border-[#2563FF] bg-[#EFF6FF] text-[#2563FF] cursor-move"
                  }`}
                  draggable={num !== null && !submitting}
                  onDragStart={(e) =>
                    num !== null &&
                    !submitting &&
                    handleDragStart(e, index, false)
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
                  onDragStart={(e) =>
                    !submitting && handleDragStart(e, index, true)
                  }
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
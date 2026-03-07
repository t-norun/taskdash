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

/* ---------------- PRACTICE ---------------- */

function makePracticeNumbers() {
  const arr = [];
  while (arr.length < 10) {
    arr.push(Math.floor(Math.random() * 1000));
  }
  return arr;
}

function isDescending(arr) {
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] < arr[i + 1]) return false;
  }
  return true;
}

/* ---------------- DEMO ---------------- */

function makeDemoNumbers() {
  const arr = [];
  while (arr.length < 10) {
    arr.push(Math.floor(Math.random() * 1000));
  }
  return arr;
}

export default function TaskPage() {

  const [taskId, setTaskId] = useState(null);
  const [priceUsd, setPriceUsd] = useState(null);

  const [numbers, setNumbers] = useState([]);
  const [orderedNumbers, setOrderedNumbers] = useState(new Array(10).fill(null));

  const [draggedIndex, setDraggedIndex] = useState(null);

  const [phase, setPhase] = useState("warmup");
  const [countdown, setCountdown] = useState(10);

  const [submitting, setSubmitting] = useState(false);

  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const intervalRef = useRef(null);

  /* ---------------- PRACTICE STATE ---------------- */

  const [practicePool, setPracticePool] = useState(makePracticeNumbers());
  const [practiceOrdered, setPracticeOrdered] = useState(new Array(10).fill(null));
  const [practiceError, setPracticeError] = useState(null);

  /* ---------------- MATCH ---------------- */

  const [waitingForMatch, setWaitingForMatch] = useState(false);
  const [waitingSubmissionId, setWaitingSubmissionId] = useState(null);
  const pollIntervalRef = useRef(null);

  const isDemo = rtIsDemoMode();

  /* ---------------- INIT ---------------- */

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

  /* ---------------- COUNTDOWN ---------------- */

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

  /* ---------------- TIMER ---------------- */

  useEffect(() => {
    if (phase === "task" && startTime) {
      intervalRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 10);
    }

    return () => clearInterval(intervalRef.current);
  }, [phase, startTime]);

  /* ---------------- PRACTICE CHECK ---------------- */

  useEffect(() => {

    if (phase !== "warmup") return;

    if (practiceOrdered.every((n) => n !== null)) {

      if (!isDescending(practiceOrdered)) {
        setPracticeError("Incorrect order. Largest → smallest.");
      } else {
        setPracticeError(null);
      }

    }

  }, [practiceOrdered, phase]);

  /* ---------------- TASK SUBMIT ---------------- */

  useEffect(() => {

    if (
      phase === "task" &&
      orderedNumbers.every((n) => n !== null) &&
      !submitting
    ) {
      handleSubmit();
    }

  }, [orderedNumbers, phase, submitting]);

  /* ---------------- MATCH POLLING ---------------- */

  useEffect(() => {

    if (waitingForMatch && waitingSubmissionId) {

      pollIntervalRef.current = setInterval(async () => {
        await checkMatchStatus();
      }, 800);

    }

    return () => clearInterval(pollIntervalRef.current);

  }, [waitingForMatch, waitingSubmissionId]);

  /* ---------------- LOAD TASK ---------------- */

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

      const taskNumbers = current?.task?.numbers || current?.numbers || [];

      if (!Array.isArray(taskNumbers) || taskNumbers.length !== 10) {
        throw new Error("Invalid task data");
      }

      setNumbers([...taskNumbers]);
      setOrderedNumbers(new Array(10).fill(null));

    } catch (error) {

      alert(error?.message || "Failed to load task");
      navigate("/");

    }

  };

  /* ---------------- DRAG ---------------- */

  const handleDragStart = (e, index, fromSource = true) => {

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));

    setDraggedIndex({ index, fromSource });

  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  /* ---------------- DROP ---------------- */

  const handleDropToSlot = (e, targetIndex) => {

    e.preventDefault();

    if (!draggedIndex) return;

    const isWarmup = phase === "warmup";

    const currentOrdered = isWarmup
      ? [...practiceOrdered]
      : [...orderedNumbers];

    if (draggedIndex.fromSource) {

      if (isWarmup) {

        const newPool = [...practicePool];
        const value = newPool[draggedIndex.index];

        if (value === undefined) return;

        newPool.splice(draggedIndex.index, 1);

        currentOrdered[targetIndex] = value;

        setPracticePool(newPool);

      } else {

        const newPool = [...numbers];
        const value = newPool[draggedIndex.index];

        if (value === undefined) return;

        newPool.splice(draggedIndex.index, 1);

        currentOrdered[targetIndex] = value;

        setNumbers(newPool);

      }

    } else {

      const temp = currentOrdered[targetIndex];
      currentOrdered[targetIndex] = currentOrdered[draggedIndex.index];
      currentOrdered[draggedIndex.index] = temp;

    }

    if (isWarmup) setPracticeOrdered(currentOrdered);
    else setOrderedNumbers(currentOrdered);

    setDraggedIndex(null);

  };

  /* ---------------- READY ---------------- */

  const handleReadyForReal = () => {

    setPhase("countdown");
    setCountdown(10);

  };

  /* ---------------- SUBMIT ---------------- */

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
        throw new Error(data?.error || "Submit failed");
      }

      if (data.statusCompat === "waiting") {

        setWaitingForMatch(true);
        setWaitingSubmissionId(data.submissionId);
        setPhase("waiting");

      } else {

        navigate(`/results?data=${encodeURIComponent(JSON.stringify(data))}`);

      }

    } catch (error) {

      alert(error?.message || "Submit failed");
      setSubmitting(false);

    }

  };

  /* ---------------- MATCH CHECK ---------------- */

  const checkMatchStatus = async () => {

    try {

      const data = await checkMatch(waitingSubmissionId);

      if (data?.statusCompat === "matched") {

        clearInterval(pollIntervalRef.current);

        navigate(`/results?data=${encodeURIComponent(JSON.stringify(data))}`);

      }

    } catch (err) {
      console.error(err);
    }

  };

  /* ---------------- UI ---------------- */

  if (phase === "warmup") {

    return (

      <div className="min-h-screen bg-white">

        <div className="max-w-[800px] mx-auto p-6">

          <h2 className="text-xl font-semibold mb-6">
            Practice
          </h2>

          <div className="grid grid-cols-5 gap-3 mb-6">

            {practiceOrdered.map((num, i) => (

              <div
                key={i}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropToSlot(e, i)}
                className="h-[80px] border-2 border-dashed rounded flex items-center justify-center text-xl"
                draggable={num !== null}
                onDragStart={(e) =>
                  num !== null && handleDragStart(e, i, false)
                }
              >
                {num ?? i + 1}
              </div>

            ))}

          </div>

          {practiceError && (
            <div className="text-red-500 mb-4">
              {practiceError}
            </div>
          )}

          <div className="grid grid-cols-5 gap-3 mb-6">

            {practicePool.map((num, i) => (

              <div
                key={i}
                draggable
                onDragStart={(e) => handleDragStart(e, i, true)}
                className="h-[80px] border rounded flex items-center justify-center text-xl"
              >
                <GripVertical size={16} className="mr-2" />
                {num}
              </div>

            ))}

          </div>

          <button
            onClick={() => {
              setPracticePool(makePracticeNumbers());
              setPracticeOrdered(new Array(10).fill(null));
              setPracticeError(null);
            }}
            className="mr-4 px-4 py-2 bg-gray-200 rounded"
          >
            Retry Practice
          </button>

          <button
            onClick={handleReadyForReal}
            className="px-6 py-2 bg-green-500 text-white rounded"
          >
            Ready for Task →
          </button>

        </div>

      </div>

    );

  }

  /* ---------------- COUNTDOWN ---------------- */

  if (phase === "countdown") {

    return (

      <div className="h-screen flex items-center justify-center text-6xl">
        {countdown}
      </div>

    );

  }

  /* ---------------- WAITING ---------------- */

  if (phase === "waiting") {

    return (

      <div className="h-screen flex flex-col items-center justify-center">

        <div className="text-xl mb-4">
          Waiting for opponent...
        </div>

        <div>
          Your time {(elapsedTime / 1000).toFixed(2)}s
        </div>

      </div>

    );

  }

  /* ---------------- TASK ---------------- */

  return (

    <div className="min-h-screen bg-white">

      <div className="max-w-[800px] mx-auto p-6">

        <div className="text-right text-xl mb-6">
          {(elapsedTime / 1000).toFixed(2)}s
        </div>

        <div className="grid grid-cols-5 gap-3 mb-6">

          {orderedNumbers.map((num, i) => (

            <div
              key={i}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropToSlot(e, i)}
              className="h-[80px] border-2 border-dashed rounded flex items-center justify-center text-xl"
              draggable={num !== null}
              onDragStart={(e) =>
                num !== null && handleDragStart(e, i, false)
              }
            >
              {num ?? i + 1}
            </div>

          ))}

        </div>

        <div className="grid grid-cols-5 gap-3">

          {numbers.map((num, i) => (

            <div
              key={i}
              draggable
              onDragStart={(e) => handleDragStart(e, i, true)}
              className="h-[80px] border rounded flex items-center justify-center text-xl"
            >
              <GripVertical size={16} className="mr-2" />
              {num}
            </div>

          ))}

        </div>

      </div>

    </div>

  );

}
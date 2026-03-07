"use client";

import { useState, useEffect, useRef } from "react";
import { navigate, getQueryParam } from "@/utils/navigation";
import { GripVertical } from "lucide-react";
import {
  getCurrent,
  submitTask,
  isDemoMode as rtIsDemoMode,
} from "@/utils/runtimeData";

function makeRandomNumbers() {
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

export default function TaskPage() {

  const [taskId, setTaskId] = useState(null);
  const [priceUsd, setPriceUsd] = useState(null);

  const [numbers, setNumbers] = useState([]);
  const [orderedNumbers, setOrderedNumbers] = useState(new Array(10).fill(null));

  const [draggedIndex, setDraggedIndex] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const intervalRef = useRef(null);

  const [phase, setPhase] = useState("warmup");
  const [countdown, setCountdown] = useState(10);

  /* practice */

  const [practicePool, setPracticePool] = useState(makeRandomNumbers());
  const [practiceOrdered, setPracticeOrdered] = useState(new Array(10).fill(null));
  const [practiceError, setPracticeError] = useState(null);

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

        setCountdown(prev => prev - 1);

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
      orderedNumbers.every(n => n !== null) &&
      !submitting
    ) {

      handleSubmit();

    }

  }, [orderedNumbers, phase, submitting]);

  /* practice validation */

  useEffect(() => {

    if (phase !== "warmup") return;

    if (practiceOrdered.every(n => n !== null)) {

      if (!isDescending(practiceOrdered)) {

        setPracticeError("Incorrect order. Sort largest → smallest");

      } else {

        setPracticeError(null);

      }

    }

  }, [practiceOrdered]);

  const loadTask = async () => {

    try {

      const current = await getCurrent(taskId);

      if (!current?.ok) {

        throw new Error(current?.error || "Failed to load task");

      }

      if (isDemo) {

        setNumbers(makeRandomNumbers());

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

  const handleDragStart = (e, index, fromSource = true) => {

    e.dataTransfer.effectAllowed = "move";

    setDraggedIndex({ index, fromSource });

  };

  const handleDragOver = (e) => {

    e.preventDefault();

  };

  const handleDropToSlot = (e, targetIndex) => {

    e.preventDefault();

    if (!draggedIndex) return;

    const isWarmup = phase === "warmup";

    const ordered = isWarmup ? [...practiceOrdered] : [...orderedNumbers];

    if (draggedIndex.fromSource) {

      const pool = isWarmup ? [...practicePool] : [...numbers];

      const value = pool[draggedIndex.index];

      pool.splice(draggedIndex.index, 1);

      const prev = ordered[targetIndex];

      ordered[targetIndex] = value;

      if (prev !== null) pool.push(prev);

      if (isWarmup) {

        setPracticePool(pool);

        setPracticeOrdered(ordered);

      } else {

        setNumbers(pool);

        setOrderedNumbers(ordered);

      }

    } else {

      const temp = ordered[targetIndex];

      ordered[targetIndex] = ordered[draggedIndex.index];

      ordered[draggedIndex.index] = temp;

      if (isWarmup) setPracticeOrdered(ordered);

      else setOrderedNumbers(ordered);

    }

    setDraggedIndex(null);

  };

  const retryPractice = () => {

    setPracticePool(makeRandomNumbers());

    setPracticeOrdered(new Array(10).fill(null));

    setPracticeError(null);

  };

  const handleReadyForReal = () => {

    setPhase("countdown");

    setCountdown(10);

  };

  const handleSubmit = async () => {

    if (orderedNumbers.some(n => n === null)) return;

    if (!startTime) return;

    setSubmitting(true);

    const timeMs = Date.now() - startTime;

    try {

      const data = await submitTask({
        attemptId: taskId,
        priceUsd,
        orderedNumbers,
        timeMs
      });

      if (!data?.ok) {

        throw new Error(data?.error || "Failed to submit");

      }

      navigate("/");

    } catch (error) {

      alert(error?.message || "Failed to submit");

      setSubmitting(false);

    }

  };

  /* ---------- UI ---------- */

  if (phase === "warmup") {

    return (
      <div className="min-h-screen bg-white font-inter">

        <div className="max-w-[800px] mx-auto px-6 py-8">

          <h3 className="text-[18px] font-semibold text-[#2B2B2B] mb-2">
            Practice
          </h3>

          <div className="grid grid-cols-5 gap-3 mb-6">

            {practiceOrdered.map((num, index) => (

              <div
                key={index}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropToSlot(e, index)}
                className="h-[80px] border-2 border-dashed rounded-lg flex items-center justify-center text-[24px]"
                draggable={num !== null}
                onDragStart={(e) =>
                  num !== null && handleDragStart(e, index, false)
                }
              >
                {num ?? index + 1}
              </div>

            ))}

          </div>

          <div className="grid grid-cols-5 gap-3 mb-6">

            {practicePool.map((num, index) => (

              <div
                key={`${num}-${index}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index, true)}
                className="h-[80px] border rounded-lg flex items-center justify-center text-[20px]"
              >
                <GripVertical size={16} className="mr-2"/>
                {num}
              </div>

            ))}

          </div>

          {practiceError && (

            <div className="text-red-500 mb-4">
              {practiceError}
            </div>

          )}

          <div className="flex gap-4">

            <button
              onClick={retryPractice}
              className="px-4 py-2 bg-gray-200 rounded"
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
      </div>
    );

  }

  if (phase === "countdown") {

    return (
      <div className="min-h-screen flex items-center justify-center text-6xl">
        {countdown}
      </div>
    );

  }

  return (
    <div className="min-h-screen bg-white">

      <div className="max-w-[800px] mx-auto px-6 py-8">

        <div className="text-right text-xl mb-6">

          {(elapsedTime / 1000).toFixed(2)}s

        </div>

        <div className="grid grid-cols-5 gap-3 mb-6">

          {orderedNumbers.map((num, index) => (

            <div
              key={index}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropToSlot(e, index)}
              className="h-[80px] border-2 border-dashed rounded-lg flex items-center justify-center text-[24px]"
              draggable={num !== null}
              onDragStart={(e) =>
                num !== null && handleDragStart(e, index, false)
              }
            >
              {num ?? index + 1}
            </div>

          ))}

        </div>

        <div className="grid grid-cols-5 gap-3">

          {numbers.map((num, index) => (

            <div
              key={`${num}-${index}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index, true)}
              className="h-[80px] border rounded-lg flex items-center justify-center text-[20px]"
            >
              <GripVertical size={16} className="mr-2"/>
              {num}
            </div>

          ))}

        </div>

      </div>

    </div>
  );

}
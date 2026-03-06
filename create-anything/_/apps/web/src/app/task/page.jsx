"use client";
console.log("噫 THIS page.jsx IS LOADED 噫");

import { useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, RefreshCw, BookOpen } from "lucide-react";
import { navigate } from "@/utils/navigation";

/* ===============================
   authenticatedFetch
================================ */
const API_HTTP = "https://api.taskdash.net";

const authenticatedFetch = async (pathOrUrl, options = {}) => {
  if (typeof window === "undefined") return fetch(pathOrUrl, options);

  const token = localStorage.getItem("taskdash_access_token") || "";
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", "Bearer " + token);

  const url =
    typeof pathOrUrl === "string" && pathOrUrl.startsWith("/api/")
      ? `${API_HTTP}${pathOrUrl}`
      : pathOrUrl;

  return fetch(url, { ...options, headers });
};

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

  // UI state・・alance縺｣縺ｽ縺・ｼ・
  const [selectedPick, setSelectedPick] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);

  const startedRef = useRef(false);
  const draggedIndexRef = useRef(null);

  /* ===============================
     price (client only)
  ================================ */
  const [price, setPrice] = useState(1);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = Number(new URLSearchParams(window.location.search).get("price") || "1");
    setPrice(toNum(p, 1));
  }, []);

  /* ===============================
     start task
  ================================ */
  const startTask = async () => {
    setBootError("");
    setPhase("loading");

    const r = await authenticatedFetch("/api/tasks/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price }),
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
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        await startTask();
      } catch (e) {
        const msg = e?.message ? e.message : String(e);
        console.error("START_ERROR=", msg);
        setBootError(msg);
        setPhase("loading");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price]);

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
     click-to-place (謨ｰ蟄励ｂcreate蟇・○)
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
    setStartTime(Date.now()); // 譎る俣繧ゅΜ繧ｻ繝・ヨ・亥・蟷ｳ・・
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
  }, [orderedNumbers, phase, submitting, attemptId, startTime]);

  /* ===============================
     derived
  ================================ */
  const filledCount = useMemo(
    () => orderedNumbers.filter((n) => n != null).length,
    [orderedNumbers]
  );

  /* ===============================
     UI (Balance螳悟・遘ｻ讀・
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
          <div className="text-[16px] font-semibold text-[#2B2B2B] mb-2">Error</div>
          <pre className="text-[12px] text-[#C33] whitespace-pre-wrap">{bootError}</pre>

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
                  setBootError(e?.message ?? String(e));
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

  // phase === "task"
  return (
    <div className="min-h-screen bg-white font-inter">
      {/* Top bar (Balance縺ｨ蜷後§) */}
      <div className="border-b border-[#EDEDED]">
        <div className="max-w-[800px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-4 border-[#2563FF] rounded-full"></div>
            <span className="text-[16px] font-semibold text-[#2B2B2B]">
              Task Dash (DEV)
            </span>
          </div>

          <div className="flex items-center gap-2">
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
        {/* Main card (Balance縺ｨ蜷後§) */}
        <div className="bg-white border border-[#F1F1F1] rounded-xl p-8 mb-6">
          <div className="flex items-start justify-between gap-6 mb-6">
            <div className="flex-1">
              <div className="text-[13px] text-[#7A7A7A] mb-1">Arrange Numbers</div>
              <div className="text-[24px] font-semibold text-[#2B2B2B]">
                Fill all 10 slots
              </div>
              <div className="text-[12px] text-[#7A7A7A] mt-1">
                Price: <span className="font-semibold text-[#2B2B2B]">${toNum(price, 1)}</span>{" "}
                ﾂｷ Progress:{" "}
                <span className="font-semibold text-[#2B2B2B]">
                  {filledCount}/10
                </span>
              </div>
              <div className="text-[12px] text-[#7A7A7A] mt-1">
                attemptId:{" "}
                <span className="font-mono text-[#2B2B2B]">{attemptId}</span>
              </div>
            </div>

            {/* 迥ｶ諷玖｡ｨ遉ｺ・・alance縺ｮ繝医・繝ｳ・・*/}
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

          {/* Slots・・alance縺ｮ繝懊ち繝ｳ隕乗ｼ縺ｧ蜀咲樟・・*/}
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
                      <span className="text-[10px] font-bold text-white">{i + 1}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Picks・井ｾ｡譬ｼ繝懊ち繝ｳ縺ｮ隕九◆逶ｮ縺ｧ螳悟・荳閾ｴ譁ｹ蜷托ｼ・*/}
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
                      <GripVertical size={14} className={active ? "opacity-80" : "opacity-50"} />
                      {num}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-[12px] text-[#7A7A7A] mt-4">
            Tip: Drag & drop also works. (UI is aligned to Balance page)
          </p>
        </div>

        <a
          href="/balance"
          className="w-full h-[48px] border border-[#E5E5E5] rounded-lg text-[14px] font-medium text-[#7A7A7A] flex items-center justify-center gap-2 hover:border-[#2563FF] hover:text-[#2563FF]"
        >
          Back to Dashboard
        </a>
      </div>

      {/* Reset Modal・・alance縺ｮAddFunds繝｢繝ｼ繝繝ｫ螳悟・遘ｻ讀搾ｼ・*/}
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




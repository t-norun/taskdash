"use client";
console.log("🚀 THIS page.jsx IS LOADED 🚀");

import { useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, RefreshCw, BookOpen } from "lucide-react";
import { navigate } from "@/utils/navigation";

/* ===============================
   authenticatedFetch
================================ */
const API_HTTP = "https://api.taskdash.net";
const ACCESS_TOKEN_KEY = "taskdash_access_token";

const getAccessToken = () => {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || "";
  } catch {
    return "";
  }
};

const authenticatedFetch = async (pathOrUrl, options = {}) => {
  if (typeof window === "undefined") return fetch(pathOrUrl, options);

  const token = getAccessToken();
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

function normalizeErrorMessage(raw) {
  const msg = String(raw || "").trim();
  if (!msg) return "unknown error";
  if (msg === "missing authorization") return "Please log in first.";
  if (msg === "start failed") return "Failed to start task.";
  if (msg === "submit failed") return "Failed to submit task.";
  return msg;
}

const getAttemptIdFromStart = (data) =>
  String(data?.attempt?.id || data?.attemptId || data?.id || "");

const getSeedFromStart = (data, fallbackAttemptId = "") =>
  String(data?.attempt?.seed || data?.seed || fallbackAttemptId || "");

const getAttemptIdFromSubmit = (data, fallbackAttemptId) =>
  String(
    data?.attempt?.id ||
      data?.attemptId ||
      data?.id ||
      data?.attempt?.attemptId ||
      fallbackAttemptId ||
      ""
  );

async function sha256Bytes(input) {
  const text = String(input || "");
  const enc = new TextEncoder().encode(text);

  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    globalThis.crypto.subtle &&
    typeof globalThis.crypto.subtle.digest === "function"
  ) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", enc);
    return new Uint8Array(digest);
  }

  throw new Error("crypto unavailable");
}

async function genNumbersSeeded(seed, count = 10, max = 20) {
  const hash = await sha256Bytes(seed);
  let idx = 0;

  const rnd = () => {
    const a = hash[idx % hash.length];
    const b = hash[(idx + 7) % hash.length];
    idx += 1;
    return ((a << 8) | b) / 65535;
  };

  const set = new Set();
  while (set.size < count) {
    const n = 1 + Math.floor(rnd() * max);
    set.add(n);
  }

  return Array.from(set);
}

async function getNumbersFromStart(data, fallbackAttemptId = "") {
  const direct = data?.attempt?.numbers ?? data?.numbers;
  if (Array.isArray(direct) && direct.length === 10) {
    return direct.map((n) => Number(n)).filter((n) => Number.isFinite(n)).slice(0, 10);
  }

  const seed = getSeedFromStart(data, fallbackAttemptId);
  if (!seed) return [];

  try {
    return await genNumbersSeeded(seed, 10, 20);
  } catch {
    return [];
  }
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
  const [priceReady, setPriceReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = Number(new URLSearchParams(window.location.search).get("price") || "1");
    setPrice(toNum(p, 1));
    setPriceReady(true);
  }, []);

  /* ===============================
     start task
  ================================ */
  const startTask = async () => {
    const token = getAccessToken();

    if (!token) {
      setBootError("Please log in first.");
      setPhase("auth");
      navigate("/balance");
      throw new Error("missing authorization");
    }

    setBootError("");
    setPhase("loading");

    const r = await authenticatedFetch("/api/tasks/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price }),
    });

    const data = await r.json().catch(() => ({}));

    if (r.status === 401) {
      navigate("/balance");
      throw new Error("missing authorization");
    }

    if (!r.ok || data?.ok === false) {
      throw new Error(data?.error || "start failed");
    }

    const newAttemptId = getAttemptIdFromStart(data);
    if (!newAttemptId) throw new Error("start: missing attemptId");

    const nums = await getNumbersFromStart(data, newAttemptId);
    if (nums.length !== 10) throw new Error("start: numbers missing");

    setAttemptId(newAttemptId);
    setNumbers(nums);
    setOrderedNumbers(Array(10).fill(null));
    setSelectedPick(null);
    setStartTime(Date.now());
    setPhase("task");
  };

  useEffect(() => {
    if (!priceReady) return;
    if (startedRef.current) return;
    startedRef.current = true;

    const token = getAccessToken();
    if (!token) {
      setBootError("Please log in first.");
      setPhase("auth");
      navigate("/balance");
      return;
    }

    (async () => {
      try {
        await startTask();
      } catch (e) {
        const msg = normalizeErrorMessage(e?.message ? e.message : String(e));
        console.error("START_ERROR=", msg);
        setBootError(msg);
        if (msg === "Please log in first.") {
          setPhase("auth");
          return;
        }
        setPhase("loading");
      }
    })();
  }, [priceReady]); // eslint-disable-line react-hooks/exhaustive-deps

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

        const token = getAccessToken();
        if (!token) {
          navigate("/balance");
          throw new Error("Please log in first.");
        }

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

        if (r.status === 401) {
          navigate("/balance");
          throw new Error("Please log in first.");
        }

        if (!r.ok || data?.ok === false) {
          throw new Error(data?.error || "submit failed");
        }

        const idForResult = getAttemptIdFromSubmit(data, attemptId);
        navigate(`/result/${idForResult}`);
      } catch (e) {
        alert(normalizeErrorMessage(e?.message || String(e)));
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
     UI
  ================================ */
  if ((phase === "loading" || phase === "auth") && !bootError) {
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
                  const token = getAccessToken();
                  if (!token) {
                    navigate("/balance");
                    setBootError("Please log in first.");
                    return;
                  }
                  setBootError("");
                  await startTask();
                } catch (e) {
                  setBootError(normalizeErrorMessage(e?.message ?? String(e)));
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
        <div className="bg-white border border-[#F1F1F1] rounded-xl p-8 mb-6">
          <div className="flex items-start justify-between gap-6 mb-6">
            <div className="flex-1">
              <div className="text-[13px] text-[#7A7A7A] mb-1">Arrange Numbers</div>
              <div className="text-[24px] font-semibold text-[#2B2B2B]">
                Fill all 10 slots
              </div>
              <div className="text-[12px] text-[#7A7A7A] mt-1">
                Price: <span className="font-semibold text-[#2B2B2B]">${toNum(price, 1)}</span>{" "}
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
                      <span className="text-[10px] font-bold text-white">{i + 1}</span>
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
                      <GripVertical size={14} className={active ? "opacity-80" : "opacity-50"} />
                      {num}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-[12px] text-[#7A7A7A] mt-4">
            Tip: Drag & drop also works.
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

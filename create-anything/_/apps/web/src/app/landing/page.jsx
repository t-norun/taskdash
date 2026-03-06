"use client";

import { useEffect, useMemo, useState } from "react";

const DEMO_BALANCE_KEY = "demo_balance";
const DEMO_TIER_KEY = "demo_selected_tier";
const DEMO_DEFAULT_BALANCE = 100;

export default function LandingPage() {
  const tiers = useMemo(() => [1, 5, 10, 20, 50], []);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [balance, setBalance] = useState(DEMO_DEFAULT_BALANCE);
  const [selectedTier, setSelectedTier] = useState(1);

  useEffect(() => {
    const token = localStorage.getItem("taskdash_access_token") || "";
    if (token) {
      window.location.href = "/";
      return;
    }

    const b = Number(localStorage.getItem(DEMO_BALANCE_KEY) || String(DEMO_DEFAULT_BALANCE));
    setBalance(Number.isFinite(b) ? b : DEMO_DEFAULT_BALANCE);

    const t = Number(localStorage.getItem(DEMO_TIER_KEY) || "1");
    setSelectedTier(Number.isFinite(t) ? t : 1);

    setCheckingAuth(false);
  }, []);

  useEffect(() => {
    localStorage.setItem(DEMO_BALANCE_KEY, String(balance));
  }, [balance]);

  useEffect(() => {
    localStorage.setItem(DEMO_TIER_KEY, String(selectedTier));
  }, [selectedTier]);

  if (checkingAuth) return null;

  const canStart = balance >= selectedTier;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border-4 border-blue-600" />
            <div className="font-semibold tracking-tight">TaskDash</div>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 border">
              Demo Mode
            </span>
          </div>

          <a
            href="/login"
            className="text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Sign in for Real Mode
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          {/* Left: Balance + Tier */}
          <div className="space-y-6">
            <div className="border rounded-2xl p-6 bg-gray-50">
              <div className="text-sm text-gray-600">Demo Balance</div>
              <div className="text-4xl font-bold mt-2">
                ${Number(balance).toFixed(2)}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Virtual credits only. No real money is used in Demo Mode.
              </div>
            </div>

            <div className="border rounded-2xl p-6 bg-gray-50">
              <div className="text-sm font-semibold mb-4">Select Demo Tier</div>
              <div className="flex flex-wrap gap-3">
                {tiers.map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTier(t)}
                    className={[
                      "px-4 py-2 rounded-lg border font-semibold transition",
                      selectedTier === t
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white hover:bg-gray-50",
                    ].join(" ")}
                  >
                    ${t}
                  </button>
                ))}
              </div>

              <button
                disabled={!canStart}
                onClick={() => (window.location.href = "/landing/task")}
                className={[
                  "mt-6 w-full py-3 rounded-xl font-semibold transition",
                  canStart
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed",
                ].join(" ")}
              >
                Start Demo Task (CPU)
              </button>

              {!canStart && (
                <div className="mt-3 text-xs text-gray-500">
                  Not enough demo credits for this tier.
                </div>
              )}
            </div>
          </div>

          {/* Right: Short explainer */}
          <div className="border rounded-2xl p-8 bg-white space-y-5">
            <h1 className="text-3xl font-bold leading-tight">
              Try the real UI,
              <br />
              with demo credits.
            </h1>

            <div className="text-sm text-gray-600 leading-relaxed">
              Demo Mode uses the same drag & drop task experience.
              Matching is simulated with a CPU opponent for instant results.
            </div>

            <div className="rounded-xl border bg-blue-50 border-blue-100 p-4 text-sm text-blue-900">
              Want real matching and real funds?
              <div className="mt-3">
                <a
                  href="/login"
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  Switch to Real Mode
                </a>
              </div>
            </div>

            <div className="text-xs text-gray-500">
              Skill-based evaluation service. Not a gambling or betting service.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
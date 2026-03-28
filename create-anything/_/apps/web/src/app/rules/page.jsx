"use client";

import React from "react";
import { navigate } from "@/utils/navigation";

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-white font-inter">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Rules
        </h1>

        <div className="mt-6 space-y-4 text-gray-700">
          <h2 className="mb-2 text-xl font-bold">How TaskDash Works</h2>
          <p className="mb-4">
            A skill-based task platform where your performance determines your
            reward.
          </p>

          <p className="mb-4 text-sm text-gray-600">
            Your task results are recorded and used to improve system accuracy
            and performance.
          </p>

          <h3 className="mb-1 font-semibold">Task Participation</h3>
          <ul className="mb-4 list-disc pl-5">
            <li>
              To join a task, you select a participation tier (e.g., $1, $5,
              $10, $20, $50).
            </li>
            <li>
              This amount acts as a participation fee for accessing the task and
              is used to determine reward calculations.
            </li>
            <li>
              All participants within the same period receive identical task
              data.
            </li>
            <li>Tasks refresh periodically (typically every 24 hours).</li>
          </ul>

          <h3 className="mb-1 font-semibold">The Task</h3>
          <ul className="mb-4 list-disc pl-5">
            <li>You receive 10 numbers (0–999).</li>
            <li>Arrange them in descending order (largest to smallest).</li>
            <li>Use drag and drop to reorder.</li>
            <li>Timing starts when the task begins and ends upon submission.</li>
            <li>Only correctly completed submissions proceed to evaluation.</li>
          </ul>

          <h3 className="mb-1 font-semibold">
            Evaluation System (Absolute Performance-Based)
          </h3>
          <p className="mb-2">Your performance is evaluated based on:</p>
          <ul className="mb-4 list-disc pl-5">
            <li>Accuracy (correct order)</li>
            <li>Speed (completion time)</li>
          </ul>
          <p className="mb-2">A final score is calculated out of 100.</p>

          <h3 className="mb-1 font-semibold">Score Threshold</h3>
          <ul className="mb-4 list-disc pl-5">
            <li>70 points or higher → Qualified performance</li>
            <li>Below 70 → Basic performance</li>
          </ul>

          <h3 className="mb-1 font-semibold">Matching System</h3>
          <ul className="mb-4 list-disc pl-5">
            <li>Qualified submissions are paired automatically.</li>
            <li>Matching is anonymous and first-come based.</li>
            <li>You cannot choose your opponent.</li>
          </ul>

          <p className="mb-2">If no match is immediately available:</p>
          <ul className="mb-4 list-disc pl-5">
            <li>Your submission enters a waiting state.</li>
            <li>
              If no match is found within the time limit, your participation fee
              is returned.
            </li>
          </ul>

          <h3 className="mb-1 font-semibold">
            Reward Distribution (Revised)
          </h3>
          <p className="mb-4">
            Rewards are determined primarily by absolute performance, with a
            limited comparative adjustment when applicable.
          </p>

          <h4 className="mb-1 font-semibold">Case 1: Both users score below 70</h4>
          <ul className="mb-4 list-disc pl-5">
            <li>Both users receive 0.97 × Tier.</li>
            <li>No competitive advantage is applied.</li>
          </ul>

          <h4 className="mb-1 font-semibold">
            Case 2: One user ≥ 70, the other &lt; 70
          </h4>
          <ul className="mb-4 list-disc pl-5">
            <li>Qualified user → 1.64 × Tier</li>
            <li>Non-qualified user → 0.30 × Tier</li>
            <li>Reward is driven by individual achievement.</li>
          </ul>

          <h4 className="mb-1 font-semibold">Case 3: Both users ≥ 70</h4>
          <p className="mb-2">
            Rewards are adjusted slightly based on score difference:
          </p>
          <ul className="mb-4 list-disc pl-5">
            <li>Score difference 0–3 → 1.20 × Tier / 0.74 × Tier</li>
            <li>Score difference 4–6 → 1.32 × Tier / 0.62 × Tier</li>
            <li>Score difference 7+ → 1.44 × Tier / 0.50 × Tier</li>
            <li>Performance comparison has limited influence.</li>
          </ul>

          <p className="mb-4">
            If scores are equal, the faster completion time determines the
            outcome.
          </p>

          <h3 className="mb-1 font-semibold">Key Principle</h3>
          <ul className="mb-4 list-disc pl-5">
            <li>Rewards are calculated and distributed by the platform.</li>
            <li>
              Performance is primarily based on individual score thresholds.
            </li>
            <li>
              Comparison only adjusts rewards within a controlled range.
            </li>
          </ul>

          <h3 className="mb-1 font-semibold">Task Completion Rules</h3>
          <ul className="mb-4 list-disc pl-5">
            <li>Leaving before submission (reload, close, logout) → forfeit</li>
            <li>Incorrect submissions → not evaluated</li>
            <li>
              Valid submissions → eligible for evaluation or refund (if
              unmatched)
            </li>
          </ul>

          <h3 className="mb-1 font-semibold">Fair Use &amp; Integrity</h3>
          <ul className="mb-4 list-disc pl-5">
            <li>Rate limits prevent excessive entries.</li>
            <li>Timing is measured in milliseconds.</li>
            <li>Identical task conditions for all users.</li>
            <li>Matching is automatic and anonymous.</li>
            <li>Anti-automation measures are implemented.</li>
          </ul>

          <h3 className="mb-1 font-semibold">Summary</h3>
          <ul className="mb-4 list-disc pl-5">
            <li>Skill and speed determine your outcome.</li>
            <li>Achieving 70+ is the key threshold.</li>
            <li>Rewards are primarily based on your own performance.</li>
          </ul>
        </div>

        <div className="mt-8">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

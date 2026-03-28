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

          {/* ✅ 追加（意味付け） */}
          <p className="mb-4 text-sm text-gray-600">
            Your task results are recorded and used to improve system accuracy and performance.
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
            <li>All participants within the same period receive identical task data.</li>
            <li>Tasks refresh periodically (typically every 24 hours).</li>
          </ul>

          <h3 className="mb-1 font-semibold">The Task</h3>
          <ul className="mb-4 list-disc pl-5">
            <li>You receive 10 numbers (0–999).</li>
            <li>Arrange them in descending order (largest to smallest).</li>
            <li>Use drag and drop to reorder the numbers.</li>
            <li>Timing starts when the task begins and ends when you submit.</li>
            <li>Only correctly completed submissions proceed to evaluation.</li>
          </ul>

          <h3 className="mb-1 font-semibold">Evaluation System</h3>
          <ul className="mb-4 list-disc pl-5">
            <li>Your performance is evaluated based on accuracy and speed.</li>
            <li>A final score is calculated out of 100.</li>
            <li>70 points or higher is treated as qualified performance.</li>
            <li>Below 70 points is treated as basic performance.</li>
          </ul>

          <h3 className="mb-1 font-semibold">Matching System</h3>
          <ul className="mb-4 list-disc pl-5">
            <li>Valid submissions are paired automatically for evaluation.</li>
            <li>Matching follows a first-come, anonymous basis.</li>
            <li>You cannot choose your opponent and cannot be matched with yourself.</li>
            <li>If no match is immediately available, your submission waits.</li>
            <li>
              If no match is found within the time limit, your participation fee
              is automatically returned.
            </li>
          </ul>

          <h3 className="mb-1 font-semibold">Reward Distribution</h3>
          <p className="mb-2">
            Rewards are determined primarily by absolute performance, with a
            limited comparison adjustment when applicable.
          </p>

          <ul className="mb-4 list-disc pl-5">
            <li>If both users score below 70, both receive 0.97 × Tier.</li>
            <li>
              If one user scores 70 or higher and the other scores below 70:
              the qualified user receives 1.64 × Tier, and the other user
              receives 0.30 × Tier.
            </li>
            <li>
              If both users score 70 or higher, rewards are adjusted based on
              performance difference.
            </li>
          </ul>

          {/* 🔥 ここ修正 */}
          <h3 className="mb-1 font-semibold">Examples When Both Users Score 70+</h3>
          <ul className="mb-4 list-disc pl-5">
            <li>Score difference 0–3 → 1.20 × Tier / 0.74 × Tier</li>
            <li>Score difference 4–6 → 1.32 × Tier / 0.62 × Tier</li>
            <li>Score difference 7+ → 1.44 × Tier / 0.50 × Tier</li>
          </ul>

          {/* ✅ 追加 */}
          <p className="mb-4">
            If scores are equal, the faster completion time determines the outcome.
          </p>

          <h3 className="mb-1 font-semibold">Core Principle</h3>
          <ul className="mb-4 list-disc pl-5">
            <li>Rewards are calculated and distributed by the platform.</li>
            <li>Performance is primarily based on individual achievement.</li>
            <li>
              Comparison only adjusts rewards within a limited and predefined
              range.
            </li>
          </ul>

          <h3 className="mb-1 font-semibold">Task Completion Rules</h3>
          <ul className="mb-4 list-disc pl-5">
            <li>
              If you leave the task before submitting (e.g., close the page,
              reload, or log out), the participation fee is forfeited.
            </li>
            <li>Incorrect submissions do not proceed to evaluation.</li>
            <li>
              Valid submissions remain eligible for evaluation or refund if
              unmatched.
            </li>
          </ul>

          <h3 className="mb-1 font-semibold">Fair Use &amp; Integrity</h3>
          <ul className="mb-4 list-disc pl-5">
            <li>Rate limits prevent excessive entries.</li>
            <li>Timing is measured in milliseconds for precision.</li>
            <li>All users receive identical task data within the same period.</li>
            <li>Matching is automatic and anonymous to maintain fairness.</li>
            <li>
              The system is designed to discourage automation and unfair
              advantages.
            </li>
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

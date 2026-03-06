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
          <h2 className="text-xl font-bold mb-2">How TaskDash Works</h2>
          <p className="mb-4">A skill-based task platform where performance determines your reward.</p>
          <h3 className="font-semibold mb-1">Task Participation</h3>
          <ul className="list-disc pl-5 mb-4">
            <li>To join a task, you select a participation tier (e.g., $1, $5, $10, $20, $50).</li>
            <li>This amount acts as a participation deposit and is temporarily held during evaluation.</li>
            <li>All participants within the same period receive identical task data.</li>
            <li>Tasks refresh periodically (typically every 24 hours).</li>
          </ul>
          <h3 className="font-semibold mb-1">The Task</h3>
          <ul className="list-disc pl-5 mb-4">
            <li>You receive 10 numbers (0–99).</li>
            <li>Arrange them in descending order (largest to smallest).</li>
            <li>Use drag and drop to reorder the numbers.</li>
            <li>Timing starts when the task begins and ends when you submit.</li>
            <li>Only correctly completed submissions proceed to evaluation.</li>
          </ul>
          <h3 className="font-semibold mb-1">Evaluation & Matching</h3>
          <ul className="list-disc pl-5 mb-4">
            <li>Correct submissions are automatically paired for evaluation.</li>
            <li>Matching follows a first-come, anonymous basis.</li>
            <li>You cannot choose your opponent and cannot be matched with yourself.</li>
            <li>If no match is immediately available, your submission waits.</li>
            <li>If no match is found within the time limit, your deposit is automatically returned.</li>
            <li>Once paired, performance is compared based on completion time.</li>
          </ul>
          <h3 className="font-semibold mb-1">Reward Distribution</h3>
          <p className="mb-2">Each match forms a shared reward pool equal to:</p>
          <p className="font-bold text-blue-600 mb-2">Selected Tier × 2</p>
          <p className="mb-2">From this pool, a fixed portion supports infrastructure and system operation.<br />The remaining amount is distributed according to performance under a fixed redistribution rule:</p>
          <ul className="list-disc pl-5 mb-4">
            <li>Top Performance → Receives 1.8 × Tier</li>
            <li>Lower Performance → Receives 0.1 × Tier</li>
            <li>Equal Performance → Both receive 0.95 × Tier</li>
          </ul>
          <h3 className="font-semibold mb-1">Task Completion Rules</h3>
          <ul className="list-disc pl-5 mb-4">
            <li>If you leave the task before submitting (e.g., close the page, reload, or log out), the participation deposit is forfeited.</li>
            <li>Incorrect submissions do not proceed to evaluation.</li>
            <li>Deposits are only forfeited in cases of task abandonment or rule violations.</li>
          </ul>
          <h3 className="font-semibold mb-1">Fair Use & Integrity</h3>
          <ul className="list-disc pl-5 mb-4">
            <li>Rate limits prevent excessive entries.</li>
            <li>Timing is measured in milliseconds for precision.</li>
            <li>All users receive identical task data within the same period.</li>
            <li>Matching is automatic and anonymous to maintain fairness.</li>
            <li>The system is designed to discourage automation and unfair advantages.</li>
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

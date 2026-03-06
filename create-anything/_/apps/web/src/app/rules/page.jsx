"use client";

import { navigate } from "@/utils/navigation";
import { ArrowLeft, DollarSign, Trophy, Users, Shield } from "lucide-react";

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-white font-inter">
      <div className="border-b border-[#EDEDED]">
        <div className="max-w-[800px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-[14px] text-[#7A7A7A] hover:text-[#2B2B2B]"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-4 border-[#2563FF] rounded-full"></div>
            <span className="text-[16px] font-semibold text-[#2B2B2B]">
              Task Dash
            </span>
          </div>

          <div className="w-[60px]"></div>
        </div>
      </div>

      <div className="max-w-[800px] mx-auto px-6 py-8">
        <h1 className="text-[28px] font-bold text-[#2B2B2B] mb-2">
          How Task Dash Works
        </h1>
        <p className="text-[14px] text-[#7A7A7A] mb-8">
          A competitive platform where speed and accuracy determine your
          earnings
        </p>

        <div className="bg-white border border-[#F1F1F1] rounded-xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign size={24} className="text-[#2563FF]" />
            <h2 className="text-[18px] font-semibold text-[#2B2B2B]">
              Job Acceptance
            </h2>
          </div>

          <div className="space-y-3 text-[14px] text-[#4C4C4C]">
            <p>
              • Each job requires a <strong>$1.00 system fee</strong> to
              participate
            </p>
            <p>• This fee is deducted from your balance immediately</p>
            <p>
              • All users work on the <strong>same task</strong> for fairness
            </p>
            <p>• The task changes periodically (typically every 24 hours)</p>
          </div>
        </div>

        <div className="bg-white border border-[#F1F1F1] rounded-xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield size={24} className="text-[#2563FF]" />
            <h2 className="text-[18px] font-semibold text-[#2B2B2B]">
              The Task
            </h2>
          </div>

          <div className="space-y-3 text-[14px] text-[#4C4C4C]">
            <p>
              • You will receive <strong>10 random numbers</strong> (0-99)
            </p>
            <p>
              • Your goal: arrange them in <strong>descending order</strong>{" "}
              (largest to smallest)
            </p>
            <p>
              • Use <strong>drag and drop</strong> to organize the numbers
            </p>
            <p>• Timer starts when the task loads and stops when you submit</p>
            <p>• Incorrect submissions result in automatic disqualification</p>
          </div>
        </div>

        <div className="bg-white border border-[#F1F1F1] rounded-xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Users size={24} className="text-[#2563FF]" />
            <h2 className="text-[18px] font-semibold text-[#2B2B2B]">
              Matching System
            </h2>
          </div>

          <div className="space-y-3 text-[14px] text-[#4C4C4C]">
            <p>
              • Only <strong>correct submissions</strong> are matched
            </p>
            <p>
              • Pairs are formed on a <strong>first-come, first-served</strong>{" "}
              basis
            </p>
            <p>
              • If no opponent is available, your submission enters a waiting
              queue
            </p>
            <p>• Once matched, the system compares completion times</p>
            <p>• You cannot be matched with yourself</p>
          </div>
        </div>

        <div className="bg-white border border-[#F1F1F1] rounded-xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Trophy size={24} className="text-[#2563FF]" />
            <h2 className="text-[18px] font-semibold text-[#2B2B2B]">
              Payout Structure
            </h2>
          </div>

          <div className="space-y-4 text-[14px] text-[#4C4C4C]">
            <div className="bg-[#D1FAE5] border border-[#6EE7B7] rounded-lg p-4">
              <div className="font-semibold text-[#059669] mb-1">Winner</div>
              <div>
                Receives <strong>$1.80</strong>
              </div>
              <div className="text-[12px] text-[#047857] mt-1">
                Net profit: +$0.80 (after $1.00 fee)
              </div>
            </div>

            <div className="bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg p-4">
              <div className="font-semibold text-[#DC2626] mb-1">Loser</div>
              <div>
                Receives <strong>$0.10</strong>
              </div>
              <div className="text-[12px] text-[#B91C1C] mt-1">
                Net loss: -$0.90 (after $1.00 fee)
              </div>
            </div>

            <div className="bg-[#E0E7FF] border border-[#C7D2FE] rounded-lg p-4">
              <div className="font-semibold text-[#4F46E5] mb-1">
                Tie (Same Time)
              </div>
              <div>
                Both receive <strong>$0.95</strong>
              </div>
              <div className="text-[12px] text-[#4338CA] mt-1">
                Net loss: -$0.05 each (after $1.00 fee)
              </div>
            </div>

            <div className="bg-[#FEF3C7] border border-[#FCD34D] rounded-lg p-4">
              <div className="font-semibold text-[#D97706] mb-1">
                Incorrect Submission
              </div>
              <div>No payout</div>
              <div className="text-[12px] text-[#B45309] mt-1">
                Net loss: -$1.00 (fee not refunded)
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-6">
          <h3 className="text-[14px] font-semibold text-[#2B2B2B] mb-3">
            Fair Play Guidelines
          </h3>
          <div className="space-y-2 text-[13px] text-[#64748B]">
            <p>• Rate limiting prevents rapid job spam</p>
            <p>• All times are measured in milliseconds for accuracy</p>
            <p>
              • Everyone gets the same 10 numbers for the current task period
            </p>
            <p>• System is designed to resist automation</p>
          </div>
        </div>

        <button
          onClick={() => navigate("/")}
          className="w-full h-[56px] bg-[#2563FF] text-white text-[16px] font-semibold rounded-lg mt-8"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

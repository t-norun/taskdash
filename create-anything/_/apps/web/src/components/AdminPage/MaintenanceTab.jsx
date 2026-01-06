import { RefreshCw } from "lucide-react";
import { useCleanupWaiting } from "@/hooks/useCleanupWaiting";

export function MaintenanceTab() {
  const { cleanupResult, cleanupLoading, handleCleanupWaiting } =
    useCleanupWaiting();

  return (
    <div className="space-y-6">
      {/* Cleanup Waiting Submissions */}
      <div className="bg-white border border-[#E5E5E5] rounded-xl p-6">
        <h3 className="text-[16px] font-semibold text-[#2B2B2B] mb-4">
          Cleanup Waiting Submissions
        </h3>
        <p className="text-[14px] text-[#7A7A7A] mb-4">
          This will refund all submissions that have been waiting for a match
          for more than 10 minutes.
        </p>
        <button
          onClick={handleCleanupWaiting}
          disabled={cleanupLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-[#F59E0B] rounded-md text-[14px] font-medium text-[#F59E0B] bg-[#FEF3C7] hover:bg-[#FEF9E7] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw
            size={16}
            className={cleanupLoading ? "animate-spin" : ""}
          />
          {cleanupLoading ? "Cleaning up..." : "Run Cleanup"}
        </button>

        {cleanupResult && (
          <div
            className={`mt-4 p-4 rounded-lg ${
              cleanupResult.error
                ? "bg-[#FEE2E2] border border-[#FCA5A5]"
                : "bg-[#D1FAE5] border border-[#6EE7B7]"
            }`}
          >
            {cleanupResult.error ? (
              <div className="text-[14px] text-[#DC2626]">
                Error: {cleanupResult.error}
              </div>
            ) : (
              <div className="text-[14px] text-[#059669]">
                ✅ {cleanupResult.message}
                <br />
                Cleaned: {cleanupResult.cleaned} submissions
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-6">
        <h3 className="text-[16px] font-semibold text-[#1E40AF] mb-3">
          💡 Maintenance Tips
        </h3>
        <ul className="space-y-2 text-[14px] text-[#1E3A8A]">
          <li>• Run cleanup during low-traffic hours to avoid disruption</li>
          <li>
            • Monitor the waiting count on the dashboard before running cleanup
          </li>
          <li>
            • Users will receive automatic refunds for timed-out submissions
          </li>
          <li>
            • Consider setting up a cron job to run this automatically every
            hour
          </li>
        </ul>
      </div>
    </div>
  );
}

import { AlertTriangle } from "lucide-react";

export function SuspiciousUsers({ users }) {
  return (
    <div className="bg-white border-2 border-[#FCA5A5] rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={20} className="text-[#EF4444]" />
        <h3 className="text-[16px] font-semibold text-[#EF4444]">
          Suspicious Users ({users.length})
        </h3>
      </div>
      <div className="space-y-3">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between border-b border-[#F6F6F6] pb-3 last:border-0"
          >
            <div>
              <div className="text-[13px] font-medium text-[#2B2B2B]">
                {user.email}
              </div>
              <div className="text-[12px] text-[#7A7A7A]">
                IP: {user.lastIp} | Device: {user.deviceId?.slice(0, 8)}...
              </div>
            </div>
            <div className="text-right">
              <div className="text-[12px] text-[#7A7A7A]">
                {user.completedTasks} tasks
              </div>
              <div className="text-[12px] font-medium text-[#EF4444]">
                {user.accuracyRate}% acc | {(user.avgTimeMs / 1000).toFixed(1)}s
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

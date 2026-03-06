import { ArrowLeft } from "lucide-react";

export function AdminHeader({ userEmail }) {
  return (
    <div className="bg-white border-b border-[#EDEDED]">
      <div className="max-w-[1400px] mx-auto px-6 h-[64px] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a
            href="/"
            className="flex items-center gap-2 text-[14px] text-[#7A7A7A] hover:text-[#2B2B2B]"
          >
            <ArrowLeft size={16} />
            Dashboard
          </a>
          <div className="w-[1px] h-6 bg-[#E5E5E5]"></div>
          <h1 className="text-[18px] font-semibold text-[#2B2B2B]">
            Admin Panel
          </h1>
        </div>
        <div className="text-[13px] text-[#7A7A7A]">{userEmail}</div>
      </div>
    </div>
  );
}


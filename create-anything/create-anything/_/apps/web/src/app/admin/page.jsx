"use client";

import { useState } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAdminData } from "@/hooks/useAdminData";
import { AdminHeader } from "@/components/AdminPage/AdminHeader";
import { AdminTabs } from "@/components/AdminPage/AdminTabs";
import { KPIDashboard } from "@/components/AdminPage/KPIDashboard";
import { WalletTab } from "@/components/AdminPage/WalletTab";
import { UserAnalyticsTab } from "@/components/AdminPage/UserAnalyticsTab";
import { MaintenanceTab } from "@/components/AdminPage/MaintenanceTab";
import { SettingsTab } from "@/components/AdminPage/SettingsTab";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("kpi");
  const { user, loading: authLoading } = useAdminAuth();
  const {
    analytics,
    wallet,
    userAnalytics,
    paypalMode,
    loading: dataLoading,
    loadData,
  } = useAdminData(activeTab);

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-white font-inter flex items-center justify-center">
        <div className="text-[14px] text-[#7A7A7A]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-inter">
      <AdminHeader userEmail={user?.email} />
      <AdminTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {activeTab === "kpi" && <KPIDashboard analytics={analytics} />}
        {activeTab === "wallet" && (
          <WalletTab wallet={wallet} onWithdrawSuccess={loadData} />
        )}
        {activeTab === "users" && (
          <UserAnalyticsTab userAnalytics={userAnalytics} />
        )}
        {activeTab === "maintenance" && <MaintenanceTab />}
        {activeTab === "settings" && <SettingsTab paypalMode={paypalMode} />}
      </div>
    </div>
  );
}

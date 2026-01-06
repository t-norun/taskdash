export function AdminTabs({ activeTab, setActiveTab }) {
  const tabs = [
    { id: "kpi", label: "KPI Dashboard" },
    { id: "wallet", label: "Platform Wallet" },
    { id: "users", label: "User Analytics" },
    { id: "maintenance", label: "Maintenance" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="bg-white border-b border-[#EDEDED]">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-2 text-[14px] font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-[#2563FF] text-[#2563FF]"
                  : "border-transparent text-[#7A7A7A] hover:text-[#2B2B2B]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

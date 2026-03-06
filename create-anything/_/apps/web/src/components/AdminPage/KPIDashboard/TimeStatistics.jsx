export function TimeStatistics({ timeStats }) {
  const stats = [
    {
      label: "Mean",
      value: (timeStats.mean / 1000).toFixed(2) + "s",
      color: "#2B2B2B",
    },
    {
      label: "Median",
      value: (timeStats.median / 1000).toFixed(2) + "s",
      color: "#2B2B2B",
    },
    {
      label: "Fastest",
      value: (timeStats.min / 1000).toFixed(2) + "s",
      color: "#10B981",
    },
    {
      label: "Slowest",
      value: (timeStats.max / 1000).toFixed(2) + "s",
      color: "#EF4444",
    },
  ];

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-6">
      <h3 className="text-[16px] font-semibold text-[#2B2B2B] mb-4">
        Completion Time Stats
      </h3>
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label}>
            <div className="text-[13px] text-[#7A7A7A] mb-1">{stat.label}</div>
            <div
              className="text-[18px] font-semibold"
              style={{ color: stat.color }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


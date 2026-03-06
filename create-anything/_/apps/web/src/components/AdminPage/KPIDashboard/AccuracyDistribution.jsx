export function AccuracyDistribution({ distribution, totalUsers }) {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-6">
      <h3 className="text-[16px] font-semibold text-[#2B2B2B] mb-4">
        Accuracy Distribution
      </h3>
      <div className="space-y-3">
        {distribution.map((item) => (
          <div key={item.range}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[13px] text-[#7A7A7A]">{item.range}</span>
              <span className="text-[13px] font-medium text-[#2B2B2B]">
                {item.count} users
              </span>
            </div>
            <div className="h-2 bg-[#F1F1F1] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2563FF]"
                style={{
                  width: `${(item.count / totalUsers) * 100}%`,
                }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


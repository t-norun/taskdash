export function LevelDistribution({ distribution }) {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-6">
      <h3 className="text-[16px] font-semibold text-[#2B2B2B] mb-4">
        Level Distribution
      </h3>
      <div className="grid grid-cols-5 gap-3">
        {distribution.slice(0, 10).map((item) => (
          <div key={item.level} className="text-center">
            <div className="text-[20px] font-bold text-[#2563FF] mb-1">
              Lv{item.level}
            </div>
            <div className="text-[13px] text-[#7A7A7A]">{item.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


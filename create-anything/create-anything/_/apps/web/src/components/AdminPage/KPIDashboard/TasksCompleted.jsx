export function TasksCompleted({ summary }) {
  const stats = [
    { label: "Total", value: summary.totalTasks },
    { label: "Correct", value: summary.correctTasks },
    { label: "Incorrect", value: summary.incorrectTasks },
    { label: "Skipped", value: summary.skippedTasks },
  ];

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-6">
      <h3 className="text-[16px] font-semibold text-[#2B2B2B] mb-4">
        Tasks Completed
      </h3>
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label}>
            <div className="text-[13px] text-[#7A7A7A] mb-1">{stat.label}</div>
            <div className="text-[18px] font-semibold text-[#2B2B2B]">
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

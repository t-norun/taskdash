export function SummaryCards({ cards }) {
  return (
    <div className="grid grid-cols-3 gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={index}
            className="bg-white border border-[#E5E5E5] rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <Icon size={20} style={{ color: card.color }} />
              <span className="text-[13px] text-[#7A7A7A]">{card.label}</span>
            </div>
            <div className="text-[28px] font-semibold text-[#2B2B2B]">
              {card.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}


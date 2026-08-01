const cards = [
  { title: "Students", value: "7" },
  { title: "Today's Classes", value: "3" },
  { title: "Pending Fees", value: "₹4,800" },
  { title: "Revenue", value: "₹18,400" },
];

export default function Stats() {
  return (
    <div className="grid grid-cols-4 gap-5 mt-8">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-2xl bg-[#131922] border border-[#2B3445] p-6"
        >
          <p className="text-slate-400">{card.title}</p>
          <h2 className="text-3xl font-bold text-white mt-2">
            {card.value}
          </h2>
        </div>
      ))}
    </div>
  );
}
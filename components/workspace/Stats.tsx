interface StatCard {
  title: string;
  value: string;
}

interface StatsProps {
  cards: readonly StatCard[];
}

export default function Stats({ cards }: Readonly<StatsProps>) {
  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-2xl border border-border bg-card p-6 shadow-card"
        >
          <p className="text-muted-foreground">{card.title}</p>
          <h2 className="mt-2 text-3xl font-bold text-foreground">{card.value}</h2>
        </div>
      ))}
    </div>
  );
}

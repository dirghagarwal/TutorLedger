"use client";

const classes = [
  {
    student: "Tanay",
    time: "4:30 PM",
  },
  {
    student: "Ritisha",
    time: "6:00 PM",
  },
];

const activity = [
  "✔ Took Aahan & Aalya class",
  "💰 Rishabh paid fees",
  "📅 Added Tanay class",
];

export default function RightPanel() {
  return (
    <aside className="w-80 border-l border-[#2B3445] bg-[#131922] p-6">
      <h2 className="text-lg font-semibold mb-5">
        Today
      </h2>

      <div className="space-y-3">
        {classes.map((item) => (
          <div
            key={item.student}
            className="rounded-xl bg-[#1B2230] p-4"
          >
            <p className="font-medium">
              {item.student}
            </p>

            <p className="text-sm text-slate-400">
              {item.time}
            </p>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold mt-8 mb-4">
        Recent Activity
      </h2>

      <div className="space-y-2">
        {activity.map((item) => (
          <div
            key={item}
            className="rounded-lg bg-[#1B2230] p-3 text-sm"
          >
            {item}
          </div>
        ))}
      </div>
    </aside>
  );
}
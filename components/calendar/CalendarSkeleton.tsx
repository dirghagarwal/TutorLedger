import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

export default function CalendarSkeleton() {
  return (
    <main className="flex min-h-screen bg-background">
      <Sidebar />
      <section className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <div className="flex-1 p-5 sm:p-8">
          <div className="mb-6 animate-pulse">
            <div className="h-4 w-24 rounded bg-border-strong/40" />
            <div className="mt-2 h-7 w-48 rounded bg-border-strong/60" />
          </div>
          <div className="rounded-2xl border border-border/60 bg-surface/50 p-4 shadow-card animate-pulse">
            <div className="mb-4 flex items-center justify-between">
              <div className="h-6 w-32 rounded bg-border-strong/50" />
              <div className="flex gap-2">
                <div className="size-8 rounded bg-border-strong/40" />
                <div className="size-8 rounded bg-border-strong/40" />
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, index) => (
                <div key={index} className="h-20 rounded-xl bg-border-strong/20 p-2 sm:h-28" />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

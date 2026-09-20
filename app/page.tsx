import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import CommandBar from "@/components/workspace/CommandBar";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground lg:flex">
      <Sidebar />
      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 ambient-gradient" />
        <div className="pointer-events-none absolute left-1/2 top-[28%] h-[26rem] w-[46rem] -translate-x-1/2 rounded-full bg-blue-500/[0.025] blur-[140px]" />

        <Topbar />

        <div className="relative flex flex-1 items-center justify-center px-5 pb-24 pt-8 sm:px-8">
          <div className="w-full max-w-4xl -translate-y-8">
            <div className="mb-6 text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-white/25">TutorLedger</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
                What would you like to record?
              </h1>
            </div>

            <CommandBar minimal />
          </div>
        </div>
      </section>
    </main>
  );
}

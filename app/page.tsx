import { requireTeacher } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import CommandBar from "@/components/workspace/CommandBar";

export const dynamic = "force-dynamic";

export default async function Home() {
  const teacher = await requireTeacher().catch(() => null);
  if (!teacher) redirect("/login");
  
  return (
    <main className="min-h-screen bg-background text-foreground lg:flex">
      <Sidebar />
      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-[18%] h-[30rem] w-[42rem] -translate-x-1/2 rounded-full bg-blue-600/[0.045] blur-[120px]" />
          <div className="absolute left-[20%] top-[52%] h-[20rem] w-[28rem] rounded-full bg-violet-500/[0.025] blur-[110px]" />
        </div>

        <Topbar />

        <div className="relative flex flex-1 items-center justify-center px-5 pb-20 pt-8 sm:px-8">
          <div className="w-full max-w-4xl -translate-y-8">
            <div className="mb-7 text-center">
              <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-2xl bg-white/[0.045] ring-1 ring-white/8">
                <span className="text-sm font-semibold tracking-tight">TL</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">How can I help?</h1>
              <p className="mt-2 text-sm text-white/40">Record classes, payments, homework and more in plain language.</p>
            </div>

            <CommandBar minimal />

            <p className="mt-4 text-center text-[11px] text-white/25">
              Try: “Took a class today” · “Received ₹2,000” · “Show unpaid classes”
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

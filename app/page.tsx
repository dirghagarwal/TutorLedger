import { requireTeacherPage } from "@/lib/auth/page-guard";
import Link from "next/link";
import { CalendarPlus, ChevronRight, CreditCard, Users } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import CommandBar from "@/components/workspace/CommandBar";

export const dynamic = "force-dynamic";

const quickActions = [
  { href: "/record", label: "Record class", icon: CalendarPlus },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/students", label: "Students", icon: Users },
];

export default async function Home() {
  await requireTeacherPage();

  return (
    <main className="min-h-screen-safe bg-background text-foreground lg:flex">
      <Sidebar />
      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute left-[18%] top-[8%] h-72 w-72 rounded-full bg-indigo-500/[0.07] blur-[100px]" />
          <div className="absolute right-[8%] top-[28%] h-80 w-80 rounded-full bg-violet-500/[0.05] blur-[110px]" />
          <div className="absolute bottom-[4%] left-[42%] h-64 w-64 rounded-full bg-cyan-500/[0.035] blur-[100px]" />
        </div>

        <Topbar />

        <div className="relative flex flex-1 items-start justify-center px-4 pb-safe pt-10 sm:px-8 sm:pt-16 lg:items-center lg:pt-6">
          <div className="w-full max-w-4xl">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-white/55 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
                <span className="size-1.5 rounded-full bg-primary shadow-[0_0_12px_rgba(142,162,255,0.9)]" />
                TutorLedger command center
              </div>
              <h1 className="text-[2.35rem] font-semibold tracking-[-0.045em] sm:text-5xl">What should we do today?</h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/45 sm:text-base">
                Record classes, update schedules, manage students and payments, or ask TutorLedger to find something for you.
              </p>
            </div>

            <div className="mt-8 rounded-[30px] border border-white/10 bg-white/[0.025] p-1.5 shadow-[0_30px_100px_rgba(0,0,0,0.32)] backdrop-blur-xl sm:mt-10">
              <CommandBar minimal />
            </div>

            <div className="mx-auto mt-5 flex max-w-2xl gap-2 overflow-x-auto pb-1">
              {quickActions.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.035] px-3.5 text-sm text-white/65 transition hover:border-primary/25 hover:bg-primary/10 hover:text-white"
                >
                  <Icon className="size-4 text-primary/80" />
                  {label}
                  <ChevronRight className="size-3.5 opacity-35 transition group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ["Record attendance", "“Aahan was present today”"],
                ["Manage payments", "“Aahan paid ₹2,000 for August”"],
                ["Change schedules", "“Move Ritisha to Friday”"],
              ].map(([title, example]) => (
                <div key={title} className="rounded-2xl border border-white/7 bg-black/10 p-4 text-left">
                  <p className="text-sm font-medium text-white/80">{title}</p>
                  <p className="mt-1.5 text-xs leading-5 text-white/35">{example}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

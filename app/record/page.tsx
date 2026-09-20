import { CalendarPlus } from "lucide-react";

import { requireTeacherPage } from "@/lib/auth/page-guard";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import RecordClassForm from "@/components/sessions/RecordClassForm";
import { findSchedules } from "@/lib/repositories/schedules";
import { findStudents } from "@/lib/repositories/students";
import { getTodayDateKey } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

export default async function RecordClassPage() {
  await requireTeacherPage();

  const [students, schedules] = await Promise.all([
    findStudents(),
    findSchedules(),
  ]);

  return (
    <main className="flex min-h-screen bg-background">
      <Sidebar />
      <section className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <div className="flex-1 p-5 sm:p-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-6 flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarPlus className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
                  Manual entry
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                  Record a class
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add or correct a class without using the AI command bar.
                </p>
              </div>
            </div>

            {students.filter((student) => student.active).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center">
                <p className="font-medium text-foreground">No active students yet.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add a student before recording a class.
                </p>
              </div>
            ) : (
              <RecordClassForm
                defaultDate={getTodayDateKey()}
                schedules={schedules}
                students={students}
              />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

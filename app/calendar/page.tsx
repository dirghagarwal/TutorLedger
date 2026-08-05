import CalendarGrid from "@/components/calendar/CalendarGrid";
import type { CalendarStudent } from "@/components/calendar/CalendarDay";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { findAttendance } from "@/lib/repositories/attendance";
import {
  getDateKey,
  getMonthCalendarDays,
  getSessionsForMonth,
  groupSessionsByDate,
} from "@/lib/services/sessions";
import { findStudents } from "@/lib/repositories/students";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const today = new Date();
  const [students, attendance, monthSessions] = await Promise.all([
    findStudents(),
    findAttendance(),
    getSessionsForMonth(today),
  ]);
  const monthLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(today);
  const studentsById: Record<string, CalendarStudent> = Object.fromEntries(
    students.map((student) => [
      student.id,
      { name: student.name, color: student.color },
    ])
  );
  const attendanceBySession = Object.fromEntries(
    attendance.map((record) => [record.sessionId, record])
  );

  return (
    <main className="flex min-h-screen bg-background">
      <Sidebar />
      <section className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <div className="flex-1 p-5 sm:p-8">
          <div className="mb-6">
            <p className="text-sm font-medium tracking-[0.24em] text-primary uppercase">
              Calendar
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              A clear view of every generated session, attendance state, and upcoming lesson.
            </p>
          </div>
          <CalendarGrid
            attendanceBySession={attendanceBySession}
            calendarDays={getMonthCalendarDays(today)}
            monthLabel={monthLabel}
            sessionsByDate={groupSessionsByDate(monthSessions)}
            studentsById={studentsById}
            today={getDateKey(today)}
          />
        </div>
      </section>
    </main>
  );
}

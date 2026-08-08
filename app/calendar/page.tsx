import CalendarGrid from "@/components/calendar/CalendarGrid";
import type { CalendarStudent } from "@/components/calendar/CalendarDay";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { findAttendance } from "@/lib/repositories/attendance";
import { findAttachmentsBySessionIds } from "@/lib/repositories/attachments";
import { findPayments } from "@/lib/repositories/payments";
import { findSessionNotesBySessionIds } from "@/lib/repositories/session-notes";
import {
  getDateKey,
  getMonthCalendarDays,
  getSessionsForMonth,
  groupSessionsByDate,
} from "@/lib/services/sessions";
import { findStudents } from "@/lib/repositories/students";
import type { SessionDetailsRecord } from "@/components/sessions/SessionDetailsSheet";

export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const requestedMonth = String((await searchParams)?.month ?? "");
  const today = requestedMonth ? new Date(`${requestedMonth}-01T00:00:00`) : new Date();
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
  const sessionIds = monthSessions.map((session) => session.id);
  const [notes, attachments, payments] = await Promise.all([
    findSessionNotesBySessionIds(sessionIds),
    findAttachmentsBySessionIds(sessionIds),
    findPayments(),
  ]);
  const detailsById: Record<string, SessionDetailsRecord> = Object.fromEntries(
    monthSessions.map((session) => [
      session.id,
      {
        session,
        studentName: studentsById[session.studentId]?.name ?? "Unknown student",
        studentColor: students.find((student) => student.id === session.studentId)?.color ?? "var(--avatar-fallback)",
        attendance: attendanceBySession[session.id] ?? null,
        payments: payments.filter((payment) => payment.sessionId === session.id),
        notes: notes.filter((note) => note.sessionId === session.id),
        attachments: attachments.filter((attachment) => attachment.sessionId === session.id),
      },
    ])
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
            monthDate={today.toISOString().slice(0, 7)}
            monthLabel={monthLabel}
            sessionsByDate={groupSessionsByDate(monthSessions)}
            sessionDetailsById={detailsById}
            studentsById={studentsById}
            today={getDateKey(today)}
          />
        </div>
      </section>
    </main>
  );
}

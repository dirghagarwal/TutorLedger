import CalendarGrid from "@/components/calendar/CalendarGrid";
import type { CalendarStudent } from "@/components/calendar/CalendarDay";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import type { SessionDetailsRecord } from "@/components/sessions/SessionDetailsSheet";
import { findAttendance } from "@/lib/repositories/attendance";
import { findAttachments } from "@/lib/repositories/attachments";
import { findPayments } from "@/lib/repositories/payments";
import { findSchedules } from "@/lib/repositories/schedules";
import { findSessionNotes } from "@/lib/repositories/session-notes";
import { findStudents } from "@/lib/repositories/students";
import {
  getDateKey,
  getMonthCalendarDays,
  getSessionsForMonth,
  groupSessionsByDate,
} from "@/lib/services/sessions";
import type { Attachment } from "@/types/attachment";
import type { Attendance } from "@/types/attendance";
import type { Payment } from "@/types/payment";
import type { SessionNote } from "@/types/session-note";
import type { Student } from "@/types/students";

export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const requestedMonth = String((await searchParams)?.month ?? "");
  const validMonth = /^\d{4}-\d{2}$/.test(requestedMonth) ? requestedMonth : null;
  const rawDate = validMonth ? new Date(`${validMonth}-01T00:00:00`) : new Date();
  const today = Number.isNaN(rawDate.getTime()) ? new Date() : rawDate;

  // Execute all repository queries in parallel (1 round-trip batch)
  const [students, attendance, schedules, payments, notes, attachments] = await Promise.all([
    findStudents(),
    findAttendance(),
    findSchedules(),
    findPayments(),
    findSessionNotes(),
    findAttachments(),
  ]);

  const monthSessions = await getSessionsForMonth(today, schedules);
  const monthLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(today);

  const studentsById: Record<string, CalendarStudent> = Object.fromEntries(
    students.map((student: Student) => [
      student.id,
      { name: student.name, color: student.color },
    ])
  );

  const attendanceBySession: Record<string, Attendance> = {};
  attendance.forEach((rec) => {
    if (rec.sessionId) attendanceBySession[rec.sessionId] = rec;
  });

  const detailsById: Record<string, SessionDetailsRecord> = Object.fromEntries(
    monthSessions.map((session) => {
      const att = attendanceBySession[session.id] ?? null;
      const matchedPayments = payments.filter((p: Payment) => p.sessionId === session.id);
      const matchedNotes = notes.filter((n: SessionNote) => n.sessionId === session.id);
      const matchedAttachments = attachments.filter((a: Attachment) => a.sessionId === session.id);

      return [
        session.id,
        {
          session,
          studentName: studentsById[session.studentId]?.name ?? "Unknown student",
          studentColor: studentsById[session.studentId]?.color ?? "var(--avatar-fallback)",
          attendance: att,
          payments: matchedPayments,
          notes: matchedNotes,
          attachments: matchedAttachments,
        },
      ];
    })
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

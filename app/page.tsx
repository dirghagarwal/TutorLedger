import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import CommandBar from "@/components/workspace/CommandBar";
import Stats from "@/components/workspace/Stats";
import RightPanel from "@/components/layout/RightPanel";
import TodayClasses, { type TodayClassItem } from "@/components/workspace/TodayClasses";
import type { SessionView } from "@/components/layout/RightPanel";
import { formatTime } from "@/lib/services/schedule";
import {
  getAllSessions,
  getNextSession,
  getTodaysSessions,
} from "@/lib/services/sessions";
import { findStudents } from "@/lib/repositories/students";
import { findAttendanceBySessionIds } from "@/lib/repositories/attendance";
import { findPayments } from "@/lib/repositories/payments";
import {
  getRevenueThisMonth,
  getTotalOutstandingBalance,
} from "@/lib/services/payments";

export const dynamic = "force-dynamic";

export default async function Home() {
  const students = await findStudents();
  const studentNames = new Map(students.map((student) => [student.id, student.name]));
  const allSessions = await getAllSessions();
  const todaySessionRecords = await getTodaysSessions(allSessions);
  const todaySessions: SessionView[] = todaySessionRecords.map(
    (session) => ({
      session,
      studentName: studentNames.get(session.studentId) ?? "Unknown student",
    })
  );
  const nextSession = await getNextSession(allSessions);
  const nextSessionView = nextSession
    ? {
        session: nextSession,
        studentName:
          studentNames.get(nextSession.studentId) ?? "Unknown student",
      }
    : null;
  const pendingFees = await getTotalOutstandingBalance(students);
  const revenueThisMonth = await getRevenueThisMonth();
  const [attendanceRecords, payments] = await Promise.all([
    findAttendanceBySessionIds(todaySessionRecords.map((session) => session.id)),
    findPayments(),
  ]);
  const attendanceBySession = new Map(attendanceRecords.map((record) => [record.sessionId, record]));
  const todayClassItems: TodayClassItem[] = todaySessionRecords.map((session) => ({
    session,
    studentName: studentNames.get(session.studentId) ?? "Unknown student",
    studentColor: students.find((student) => student.id === session.studentId)?.color ?? "var(--avatar-fallback)",
    attendance: attendanceBySession.get(session.id) ?? null,
    payments: payments.filter((payment) => payment.sessionId === session.id),
  }));

  return (
    <main className="flex min-h-screen min-w-0 flex-col bg-background lg:flex-row">
      <Sidebar />

      <section className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        <div className="p-4 sm:p-8">
          <CommandBar />
          <TodayClasses initialItems={todayClassItems} />
          <Stats
            cards={[
              { title: "Students", value: String(students.length) },
              { title: "Today's Sessions", value: String(todaySessions.length) },
              {
                title: "Next Session",
                value: nextSessionView
                  ? formatTime(nextSessionView.session.startTime)
                  : "None",
              },
              {
                title: "Pending Fees",
                value: new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 0,
                }).format(pendingFees),
              },
              {
                title: "Revenue This Month",
                value: new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 0,
                }).format(revenueThisMonth),
              },
            ]}
          />
        </div>
      </section>

      <RightPanel className="hidden xl:block" nextSession={nextSessionView} todaySessions={todaySessions} />
      <RightPanel className="w-full border-t border-l-0 p-4 xl:hidden sm:p-6" nextSession={nextSessionView} todaySessions={todaySessions} />
    </main>
  );
}

import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import ReportsClient from "@/components/reports/ReportsClient";
import { findAttendance } from "@/lib/repositories/attendance";
import { findPayments } from "@/lib/repositories/payments";
import { findSessions } from "@/lib/repositories/sessions";
import { findStudents } from "@/lib/repositories/students";
import { getAttendanceSummary } from "@/lib/services/attendance";
import {
  getLifetimePayments,
  getOutstandingBalance,
  getRevenueThisMonth,
  getRevenueThisYear,
} from "@/lib/services/payments";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [students, attendanceRecords, payments, sessions] = await Promise.all([
    findStudents(),
    findAttendance(),
    findPayments(),
    findSessions(),
  ]);

  const overallAttendanceSummary = getAttendanceSummary(attendanceRecords);
  const revenueMonth = await getRevenueThisMonth(payments);
  const revenueYear = await getRevenueThisYear(payments);

  const studentReportData = await Promise.all(
    students.map(async (student) => {
      const studentAttendance = attendanceRecords.filter((a) => {
        const sess = sessions.find((s) => s.id === a.sessionId);
        return sess ? sess.studentId === student.id : false;
      });
      const summary = getAttendanceSummary(studentAttendance);

      const [outstanding, paid] = await Promise.all([
        getOutstandingBalance(student.id, payments, students, sessions, attendanceRecords),
        getLifetimePayments(student.id, payments),
      ]);

      return {
        student,
        attendanceSummary: summary,
        outstandingBalance: outstanding,
        lifetimePaid: paid,
      };
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
              Analytics & Insights
            </p>
            <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
              Tuition Performance Reports
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Comprehensive report on attendance rates, monthly collections, fee breakdowns, and student performance summaries.
            </p>
          </div>

          <ReportsClient
            attendanceSummary={overallAttendanceSummary}
            revenueMonth={revenueMonth}
            revenueYear={revenueYear}
            studentReports={studentReportData}
            totalStudents={students.length}
          />
        </div>
      </section>
    </main>
  );
}

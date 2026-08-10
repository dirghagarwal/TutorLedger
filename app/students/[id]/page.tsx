import { ArrowLeft, CalendarDays, IndianRupee, WalletCards } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import Sidebar from "@/components/layout/Sidebar";
import AttendanceTimeline from "@/components/students/AttendanceTimeline";
import MonthlyClassTracker from "@/components/students/MonthlyClassTracker";
import PaymentHistory from "@/components/students/PaymentHistory";
import SessionTimeline from "@/components/students/SessionTimeline";
import StudentProfileActions from "@/components/students/StudentProfileActions";
import Topbar from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { findAttendance } from "@/lib/repositories/attendance";
import { findSessions } from "@/lib/repositories/sessions";
import { findStudentById } from "@/lib/repositories/students";
import { findAttachmentsBySessionIds } from "@/lib/repositories/attachments";
import { getAttendanceForStudent, getAttendanceSummary } from "@/lib/services/attendance";
import {
  getLifetimePayments,
  getOutstandingBalance,
  getPaymentHistory,
  getRecentPayment,
} from "@/lib/services/payments";
import {
  formatTime,
  formatWeeklySchedule,
  getNextUpcomingClass,
  getSchedulesForStudent,
  getTodaysClasses,
} from "@/lib/services/schedule";
import { findSessionNotesBySessionIds } from "@/lib/repositories/session-notes";
import { findPayments } from "@/lib/repositories/payments";
import { FeeType } from "@/types/students";

export const dynamic = "force-dynamic";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const feeTypeLabels: Record<FeeType, string> = {
  [FeeType.CLASSWISE]: "Class-wise",
  [FeeType.MONTHLY]: "Monthly",
};

export default async function StudentProfilePage({
  params,
}: PageProps<"/students/[id]">) {
  const { id } = await params;
  const [
    student,
    studentAttendance,
    studentSchedules,
    allPayments,
    allSessions,
    allAttendance,
  ] = await Promise.all([
    findStudentById(id),
    getAttendanceForStudent(id),
    getSchedulesForStudent(id),
    findPayments(),
    findSessions(),
    findAttendance(),
  ]);

  if (!student) {
    notFound();
  }

  const attendanceSummary = getAttendanceSummary(studentAttendance);
  const todaysClasses = getTodaysClasses(studentSchedules);
  const nextClass = getNextUpcomingClass(studentSchedules);
  const studentPayments = await getPaymentHistory(student.id, allPayments);
  const outstandingBalance = await getOutstandingBalance(
    student.id,
    allPayments,
    [student],
    allSessions,
    allAttendance
  );
  const lifetimePayments = await getLifetimePayments(student.id, allPayments);
  const recentPayment = await getRecentPayment(student.id, allPayments);
  const studentSessions = allSessions.filter((s) => s.studentId === student.id);

  const [sessionNotes, sessionAttachments] = await Promise.all([
    findSessionNotesBySessionIds(studentSessions.map((session) => session.id)),
    findAttachmentsBySessionIds(studentSessions.map((session) => session.id)),
  ]);

  const paymentsBySession = Object.fromEntries(
    studentSessions.map((session) => [session.id, allPayments.filter((payment) => payment.sessionId === session.id)])
  );
  const notesBySession = Object.fromEntries(
    studentSessions.map((session) => [session.id, sessionNotes.filter((note) => note.sessionId === session.id)])
  );
  const attachmentsBySession = Object.fromEntries(
    studentSessions.map((session) => [session.id, sessionAttachments.filter((attachment) => attachment.sessionId === session.id)])
  );

  return (
    <main className="flex min-h-screen bg-background">
      <Sidebar />
      <section className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <div className="flex-1 p-5 sm:p-8">
          <Button
            className="mb-6 text-secondary-foreground hover:bg-muted hover:text-foreground"
            nativeButton={false}
            render={<Link href="/students" />}
            variant="ghost"
          >
            <ArrowLeft />
            Back to students
          </Button>

          <Card className="max-w-3xl border-border-strong bg-surface text-foreground shadow-card">
            <CardHeader className="flex-row items-center justify-between gap-4 border-b border-border/50 pb-6">
              <div className="flex items-center gap-4">
                <div
                  className="flex size-14 items-center justify-center rounded-2xl text-lg font-bold"
                  style={{ backgroundColor: student.color }}
                >
                  {student.name
                    .split(/\s+/)
                    .filter((part) => part !== "&")
                    .slice(0, 2)
                    .map((part) => part[0] ?? "")
                    .join("")
                    .toUpperCase()}
                </div>
                <div>
                  <CardTitle className="text-2xl text-foreground">{student.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{student.subject}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  className="border-success/20 bg-success/10 text-success"
                  variant="outline"
                >
                  {student.active ? "Active" : "Archived"}
                </Badge>
                <StudentProfileActions schedules={studentSchedules} student={student} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
              <Detail icon={<IndianRupee />} label="Fee model">
                {feeTypeLabels[student.feeType]}
              </Detail>
              <Detail icon={<IndianRupee />} label="Fee amount">
                {currencyFormatter.format(student.fee)}
              </Detail>
              <Detail icon={<CalendarDays />} label="Weekly schedule">
                {formatWeeklySchedule(studentSchedules) || "No active schedule"}
              </Detail>
              <Detail icon={<CalendarDays />} label="Upcoming class">
                {nextClass
                  ? `${nextClass.date} · ${formatTime(nextClass.schedule.startTime)}`
                  : "No upcoming class"}
              </Detail>
              <Detail label="Today's status">
                {todaysClasses.length > 0 ? "Class scheduled" : "No class scheduled"}
              </Detail>
              <Detail icon={<WalletCards />} label="Outstanding balance">
                {currencyFormatter.format(outstandingBalance)}
              </Detail>
              <Detail label="Total classes attended">
                {attendanceSummary.attendedClasses}
              </Detail>
            </CardContent>
          </Card>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <AttendanceTimeline records={studentAttendance} />
            <Card className="h-fit border-border-strong bg-surface text-foreground shadow-card">
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="text-lg text-foreground">Class summary</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 pt-5">
                <SummaryRow label="Attended" value={attendanceSummary.attendedClasses} />
                <SummaryRow label="Absent" value={attendanceSummary.absentClasses} />
                <SummaryRow label="Cancelled" value={attendanceSummary.cancelledClasses} />
                <SummaryRow
                  label="Rescheduled"
                  value={attendanceSummary.rescheduledClasses}
                />
              </CardContent>
            </Card>
          </div>

          <div className="mt-6">
            <MonthlyClassTracker
              attachmentsBySession={attachmentsBySession}
              attendance={studentAttendance}
              notesBySession={notesBySession}
              paymentsBySession={paymentsBySession}
              schedules={studentSchedules}
              sessions={studentSessions}
              student={student}
            />
          </div>

          <div className="mt-6">
            <SessionTimeline
              attachmentsBySession={attachmentsBySession}
              attendanceBySession={Object.fromEntries(studentAttendance.map((attendance) => [attendance.sessionId, attendance]))}
              notesBySession={notesBySession}
              paymentsBySession={paymentsBySession}
              sessions={studentSessions}
            />
          </div>

          <div className="mt-6">
            <PaymentHistory
              lifetimePayments={lifetimePayments}
              outstandingBalance={outstandingBalance}
              payments={studentPayments}
            />
            {recentPayment && (
              <p className="mt-3 text-sm text-muted-foreground">
                Recent payment: {currencyFormatter.format(recentPayment.amount)} on {recentPayment.date}.
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Detail({
  children,
  icon,
  label,
}: Readonly<{
  children: React.ReactNode;
  icon?: React.ReactNode;
  label: string;
}>) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 font-medium text-foreground">{children}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: Readonly<{ label: string; value: number }>) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

import { ArrowLeft, CalendarDays, IndianRupee, WalletCards } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import Sidebar from "@/components/layout/Sidebar";
import AttendanceTimeline from "@/components/students/AttendanceTimeline";
import PaymentHistory from "@/components/students/PaymentHistory";
import SessionTimeline from "@/components/students/SessionTimeline";
import StudentProfileActions from "@/components/students/StudentProfileActions";
import Topbar from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { findStudentById } from "@/lib/repositories/students";
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
import {
  getPastSessions,
  getSessionsByStudent,
  getUpcomingSessions,
} from "@/lib/services/sessions";
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
  const student = await findStudentById(id);

  if (!student) {
    notFound();
  }

  const studentAttendance = await getAttendanceForStudent(student.id);
  const attendanceSummary = getAttendanceSummary(studentAttendance);
  const studentSchedules = await getSchedulesForStudent(student.id);
  const todaysClasses = getTodaysClasses(studentSchedules);
  const nextClass = getNextUpcomingClass(studentSchedules);
  const [studentPayments, outstandingBalance, lifetimePayments, recentPayment] =
    await Promise.all([
      getPaymentHistory(student.id),
      getOutstandingBalance(student.id),
      getLifetimePayments(student.id),
      getRecentPayment(student.id),
    ]);
  const studentSessions = await getSessionsByStudent(student.id);
  const [upcomingSessions, pastSessions] = await Promise.all([
    getUpcomingSessions(studentSessions),
    getPastSessions(studentSessions),
  ]);

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
                <StudentProfileActions student={student} />
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
            <SessionTimeline
              pastSessions={pastSessions}
              upcomingSessions={upcomingSessions}
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

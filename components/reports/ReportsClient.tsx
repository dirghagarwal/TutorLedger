"use client";

import { useMemo } from "react";
import { TrendingUp, Users, CheckCircle2, IndianRupee } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Student } from "@/types/students";
import type { AttendanceSummary } from "@/lib/services/attendance";

interface StudentReportItem {
  student: Student;
  attendanceSummary: AttendanceSummary;
  outstandingBalance: number;
  lifetimePaid: number;
}

interface ReportsClientProps {
  attendanceSummary: AttendanceSummary;
  revenueMonth: number;
  revenueYear: number;
  studentReports: StudentReportItem[];
  totalStudents: number;
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default function ReportsClient({
  attendanceSummary,
  revenueMonth,
  revenueYear,
  studentReports,
  totalStudents,
}: Readonly<ReportsClientProps>) {
  const attendanceRate = useMemo(() => {
    if (attendanceSummary.totalClasses === 0) return 100;
    return Math.round((attendanceSummary.attendedClasses / attendanceSummary.totalClasses) * 100);
  }, [attendanceSummary]);

  const classwiseStudentsCount = useMemo(
    () => studentReports.filter((r) => r.student.feeType === "CLASSWISE").length,
    [studentReports]
  );
  const monthlyStudentsCount = useMemo(
    () => studentReports.filter((r) => r.student.feeType === "MONTHLY").length,
    [studentReports]
  );

  return (
    <div className="space-y-8">
      {/* High Level Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border-strong bg-surface text-foreground shadow-card">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Active Students
            </CardTitle>
            <Users className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalStudents}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {monthlyStudentsCount} Monthly · {classwiseStudentsCount} Classwise
            </p>
          </CardContent>
        </Card>

        <Card className="border-border-strong bg-surface text-foreground shadow-card">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Attendance Completion Rate
            </CardTitle>
            <CheckCircle2 className="size-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{attendanceRate}%</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {attendanceSummary.attendedClasses} of {attendanceSummary.totalClasses} classes attended
            </p>
          </CardContent>
        </Card>

        <Card className="border-border-strong bg-surface text-foreground shadow-card">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Revenue (This Month)
            </CardTitle>
            <IndianRupee className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {currencyFormatter.format(revenueMonth)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Collections in current month</p>
          </CardContent>
        </Card>

        <Card className="border-border-strong bg-surface text-foreground shadow-card">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Revenue (This Year)
            </CardTitle>
            <TrendingUp className="size-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {currencyFormatter.format(revenueYear)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Year-to-date collections</p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Stats Breakdown */}
      <Card className="border-border-strong bg-surface text-foreground shadow-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-lg text-foreground">Attendance Distribution</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-4">
          <div className="rounded-xl border border-success/20 bg-success/5 p-4 text-center">
            <p className="text-2xl font-bold text-success">{attendanceSummary.attendedClasses}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">Present</p>
          </div>
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{attendanceSummary.absentClasses}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">Absent</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/40 p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{attendanceSummary.cancelledClasses}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">Cancelled</p>
          </div>
          <div className="rounded-xl border border-info/20 bg-info/5 p-4 text-center">
            <p className="text-2xl font-bold text-info">{attendanceSummary.rescheduledClasses}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">Rescheduled</p>
          </div>
        </CardContent>
      </Card>

      {/* Student Summary Table */}
      <Card className="border-border-strong bg-surface text-foreground shadow-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-lg text-foreground">Student-Wise Summary Report</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/50 bg-surface-subtle/80 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Fee Model</th>
                  <th className="px-4 py-3">Attended</th>
                  <th className="px-4 py-3">Total Paid</th>
                  <th className="px-4 py-3">Outstanding</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {studentReports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                      No student records available.
                    </td>
                  </tr>
                ) : (
                  studentReports.map(({ student, attendanceSummary: sum, outstandingBalance, lifetimePaid }) => (
                    <tr key={student.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">{student.name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{student.subject}</td>
                      <td className="px-4 py-3 text-xs text-secondary-foreground">
                        {student.feeType} (₹{student.fee})
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {sum.attendedClasses} classes
                      </td>
                      <td className="px-4 py-3 font-bold text-foreground">
                        {currencyFormatter.format(lifetimePaid)}
                      </td>
                      <td className={`px-4 py-3 font-bold ${outstandingBalance > 0 ? "text-warning" : "text-success"}`}>
                        {currencyFormatter.format(outstandingBalance)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={student.active ? "default" : "outline"}>
                          {student.active ? "Active" : "Archived"}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

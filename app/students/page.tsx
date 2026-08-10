import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import StudentsClient, { type StudentListItem } from "@/components/students/StudentsClient";
import { findAttendance } from "@/lib/repositories/attendance";
import { findPayments } from "@/lib/repositories/payments";
import { findSchedules } from "@/lib/repositories/schedules";
import { findSessions } from "@/lib/repositories/sessions";
import { findStudents } from "@/lib/repositories/students";
import { getAttendedClassCount } from "@/lib/services/attendance";
import { formatWeeklySchedule } from "@/lib/services/schedule";
import { getOutstandingBalance, getTotalOutstandingBalance } from "@/lib/services/payments";
import type { Attendance } from "@/types/attendance";
import type { Schedule } from "@/types/schedule";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  // Execute all repository queries in parallel (1 round-trip batch)
  const [students, attendanceRecords, schedules, payments, sessions] = await Promise.all([
    findStudents(),
    findAttendance(),
    findSchedules(),
    findPayments(),
    findSessions(),
  ]);

  const pendingFeesTotal = await getTotalOutstandingBalance(students, payments);

  const sessionStudentMap = new Map<string, string>();
  for (const session of sessions) {
    sessionStudentMap.set(session.id, session.studentId);
  }

  const attendanceByStudent = new Map<string, Attendance[]>();
  for (const record of attendanceRecords) {
    const studentId = sessionStudentMap.get(record.sessionId);
    if (studentId) {
      const existing = attendanceByStudent.get(studentId) ?? [];
      existing.push(record);
      attendanceByStudent.set(studentId, existing);
    }
  }

  const schedulesByStudent = new Map<string, Schedule[]>();
  for (const schedule of schedules) {
    const existing = schedulesByStudent.get(schedule.studentId) ?? [];
    existing.push(schedule);
    schedulesByStudent.set(schedule.studentId, existing);
  }

  const items: StudentListItem[] = await Promise.all(
    students.map(async (student) => {
      const studentAttendance = attendanceByStudent.get(student.id) ?? [];
      const studentSchedules = schedulesByStudent.get(student.id) ?? [];
      const outstandingBalance = await getOutstandingBalance(student.id, payments, students, sessions, attendanceRecords);

      return {
        attendedClasses: getAttendedClassCount(studentAttendance),
        outstandingBalance,
        student,
        weeklySchedule: formatWeeklySchedule(studentSchedules) || "No active schedule",
      };
    })
  );

  return (
    <main className="flex min-h-screen bg-background">
      <Sidebar />

      <section className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        <div className="flex-1 p-5 sm:p-8">
          <StudentsClient initialItems={items} initialPendingFees={pendingFeesTotal} />
        </div>
      </section>
    </main>
  );
}

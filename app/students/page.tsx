import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import StudentsClient, { type StudentListItem } from "@/components/students/StudentsClient";
import { findStudents } from "@/lib/repositories/students";
import { getAttendedClassCount, getAttendanceForStudent } from "@/lib/services/attendance";
import {
  formatWeeklySchedule,
  getSchedulesForStudent,
} from "@/lib/services/schedule";
import {
  getOutstandingBalance,
  getTotalOutstandingBalance,
} from "@/lib/services/payments";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const students = await findStudents();
  const pendingFeesTotal = await getTotalOutstandingBalance(students);
  const items: StudentListItem[] = await Promise.all(
    students.map(async (student) => {
      const [attendanceRecords, outstandingBalance, studentSchedules] = await Promise.all([
        getAttendanceForStudent(student.id),
        getOutstandingBalance(student.id),
        getSchedulesForStudent(student.id),
      ]);
      return {
        attendedClasses: getAttendedClassCount(attendanceRecords),
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

import { findAttendanceBySession, findAttendanceBySessionIds } from "@/lib/repositories/attendance";
import { findSessionsByStudent } from "@/lib/repositories/sessions";
import { AttendanceStatus, type Attendance } from "@/types/attendance";

export interface AttendanceSummary {
  attendedClasses: number;
  absentClasses: number;
  cancelledClasses: number;
  rescheduledClasses: number;
  totalClasses: number;
}

export async function getAttendanceForStudent(
  studentId: string
): Promise<Attendance[]> {
  const studentSessions = await findSessionsByStudent(studentId);
  const records = await findAttendanceBySessionIds(
    studentSessions.map((session) => session.id)
  );
  return records.sort((first, second) =>
    `${second.date}T${second.startTime}`.localeCompare(
      `${first.date}T${first.startTime}`
    )
  );
}

export async function getAttendanceForSession(
  sessionId: string
): Promise<Attendance | null> {
  return findAttendanceBySession(sessionId);
}

export function getAttendanceSummary(
  records: readonly Attendance[]
): AttendanceSummary {
  const summary = records.reduce<Omit<AttendanceSummary, "totalClasses">>(
    (acc, record) => {
      switch (record.status) {
        case AttendanceStatus.PRESENT:
          acc.attendedClasses += 1;
          break;
        case AttendanceStatus.ABSENT:
          acc.absentClasses += 1;
          break;
        case AttendanceStatus.CANCELLED:
          acc.cancelledClasses += 1;
          break;
        case AttendanceStatus.RESCHEDULED:
          acc.rescheduledClasses += 1;
          break;
      }
      return acc;
    },
    {
      attendedClasses: 0,
      absentClasses: 0,
      cancelledClasses: 0,
      rescheduledClasses: 0,
    }
  );

  return {
    ...summary,
    totalClasses:
      summary.attendedClasses +
      summary.absentClasses +
      summary.cancelledClasses +
      summary.rescheduledClasses,
  };
}

export function getAttendedClassCount(
  records: readonly Attendance[]
): number {
  return getAttendanceSummary(records).attendedClasses;
}

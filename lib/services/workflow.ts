import { AttendanceStatus } from "@/types/attendance";
import { SessionStatus } from "@/types/session";

export function getSessionStatusForAttendance(status: AttendanceStatus): SessionStatus {
  if (status === AttendanceStatus.CANCELLED) return SessionStatus.CANCELLED;
  if (status === AttendanceStatus.RESCHEDULED) return SessionStatus.RESCHEDULED;
  return SessionStatus.COMPLETED;
}

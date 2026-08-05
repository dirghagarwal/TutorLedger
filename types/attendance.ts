export enum AttendanceStatus {
  PRESENT = "PRESENT",
  ABSENT = "ABSENT",
  CANCELLED = "CANCELLED",
  RESCHEDULED = "RESCHEDULED",
}

export interface Attendance {
  id: string;
  sessionId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AttendanceStatus;
  notes: string;
}

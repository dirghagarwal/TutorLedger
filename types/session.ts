export enum SessionStatus {
  PLANNED = "PLANNED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  RESCHEDULED = "RESCHEDULED",
}

export interface Session {
  id: string;
  studentId: string;
  scheduleId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
}

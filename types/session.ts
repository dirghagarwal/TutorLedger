export enum SessionStatus {
  PLANNED = "PLANNED",
  IN_PROGRESS = "IN_PROGRESS",
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
  startedAt?: string | null;
  endedAt?: string | null;
  durationMinutes?: number | null;
}

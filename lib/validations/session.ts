import { z } from "zod";

import { AttachmentType } from "@/types/attachment";
import { AttendanceStatus } from "@/types/attendance";
import { SessionStatus } from "@/types/session";

export const sessionNoteInputSchema = z.object({
  sessionId: z.string().min(1),
  studentId: z.string().min(1).optional(),
  scheduleId: z.string().min(1).optional(),
  date: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  topic: z.string().trim().default("Session Notes"),
  classwork: z.string().trim().default(""),
  homework: z.string().trim().default(""),
  remarks: z.string().trim().default(""),
});

export const attachmentTypeSchema = z.enum([
  AttachmentType.IMAGE,
  AttachmentType.PDF,
  AttachmentType.FILE,
]);

export type SessionNoteInput = z.infer<typeof sessionNoteInputSchema>;

export const sessionEditInputSchema = z.object({
  sessionId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  status: z.nativeEnum(SessionStatus),
  attendanceStatus: z.nativeEnum(AttendanceStatus).optional(),
}).superRefine((values, ctx) => {
  const [startHour, startMinute] = values.startTime.split(":").map(Number);
  const [endHour, endMinute] = values.endTime.split(":").map(Number);
  if ((endHour * 60 + endMinute) <= (startHour * 60 + startMinute)) {
    ctx.addIssue({ code: "custom", path: ["endTime"], message: "End time must be after start time." });
  }
});

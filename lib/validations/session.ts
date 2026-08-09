import { z } from "zod";

import { AttachmentType } from "@/types/attachment";

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
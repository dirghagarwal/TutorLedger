import { z } from "zod";

import { AttachmentType } from "@/types/attachment";

export const sessionNoteInputSchema = z.object({
  sessionId: z.string().min(1),
  topic: z.string().trim().min(1).max(120),
  classwork: z.string().trim().max(5000),
  homework: z.string().trim().max(5000),
  remarks: z.string().trim().max(5000),
});

export const attachmentTypeSchema = z.enum([
  AttachmentType.IMAGE,
  AttachmentType.PDF,
  AttachmentType.FILE,
]);

export type SessionNoteInput = z.infer<typeof sessionNoteInputSchema>;
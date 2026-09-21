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

export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".pdf",
]);

export interface AttachmentValidationResult {
  valid: boolean;
  error?: string;
  inferredType?: AttachmentType;
}

export function validateAttachmentFile(
  filename: string,
  mimeType: string,
  sizeBytes: number,
  buffer?: Uint8Array | null,
): AttachmentValidationResult {
  if (!filename || sizeBytes <= 0) {
    return { valid: false, error: "Choose a valid, non-empty file to upload." };
  }

  if (sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
    return { valid: false, error: "File exceeds the maximum permitted size of 5 MB." };
  }

  const cleanFilename = filename.trim().toLowerCase();
  const extIndex = cleanFilename.lastIndexOf(".");
  if (extIndex === -1) {
    return { valid: false, error: "File must have an allowed extension (.jpg, .jpeg, .png, .webp, .pdf)." };
  }

  const ext = cleanFilename.slice(extIndex);
  if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `File extension "${ext}" is not permitted. Only JPG, PNG, WebP and PDF are supported.`,
    };
  }

  const cleanMime = (mimeType || "").trim().toLowerCase();
  if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(cleanMime)) {
    return {
      valid: false,
      error: `File MIME type "${cleanMime}" is not permitted. Only images and PDFs are allowed.`,
    };
  }

  // Cross-check extension with declared MIME type
  if ((ext === ".pdf" && cleanMime !== "application/pdf") ||
      ((ext === ".jpg" || ext === ".jpeg") && cleanMime !== "image/jpeg") ||
      (ext === ".png" && cleanMime !== "image/png") ||
      (ext === ".webp" && cleanMime !== "image/webp")) {
    return { valid: false, error: "File extension does not match file content type." };
  }

  // Server-side magic bytes validation if buffer is available
  if (buffer && buffer.length >= 4) {
    if (cleanMime === "image/jpeg") {
      const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      if (!isJpeg) return { valid: false, error: "File content does not match JPEG signature." };
    } else if (cleanMime === "image/png") {
      const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
      if (!isPng) return { valid: false, error: "File content does not match PNG signature." };
    } else if (cleanMime === "application/pdf") {
      const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46; // %PDF
      if (!isPdf) return { valid: false, error: "File content does not match PDF signature." };
    } else if (cleanMime === "image/webp") {
      const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46; // RIFF
      if (!isRiff) return { valid: false, error: "File content does not match WebP signature." };
    }
  }

  const inferredType = cleanMime === "application/pdf" ? AttachmentType.PDF : AttachmentType.IMAGE;
  return { valid: true, inferredType };
}

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

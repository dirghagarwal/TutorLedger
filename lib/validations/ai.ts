import { z } from "zod";
import { AttendanceStatus } from "@/types/attendance";
import { PaymentMethod } from "@/types/payment";
import { FeeType } from "@/types/students";

export const recordAttendanceIntentSchema = z.object({
  action: z.literal("RECORD_ATTENDANCE"),
  studentName: z.string().nullable().optional(),
  status: z.nativeEnum(AttendanceStatus).optional().default(AttendanceStatus.PRESENT),
  date: z.string().optional(),
});

export const createStudentIntentSchema = z.object({
  action: z.literal("CREATE_STUDENT"),
  name: z.string().min(1, "Student name is required"),
  subject: z.string().min(1, "Subject is required"),
  fee: z.number().positive("Fee must be positive"),
  feeType: z.nativeEnum(FeeType),
});

export const recordPaymentIntentSchema = z.object({
  action: z.literal("RECORD_PAYMENT"),
  studentName: z.string().nullable().optional(),
  amount: z.number().positive("Amount must be positive"),
  method: z.nativeEnum(PaymentMethod).optional().default(PaymentMethod.UPI),
  notes: z.string().optional().default("Recorded via Gemini AI"),
});

export const queryStatsIntentSchema = z.object({
  action: z.literal("QUERY_STATS"),
  topic: z.enum(["PENDING_FEES", "TODAY_CLASSES", "REVENUE", "STUDENT_LIST"]),
});

export const deleteStudentIntentSchema = z.object({
  action: z.literal("DELETE_STUDENT_REQUEST"),
  studentName: z.string().nullable().optional(),
});

export const deleteSessionIntentSchema = z.object({
  action: z.literal("DELETE_SESSION"),
  studentName: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
});

export const startClassIntentSchema = z.object({
  action: z.literal("START_CLASS"),
  studentName: z.string().nullable().optional(),
});

export const endClassIntentSchema = z.object({
  action: z.literal("END_CLASS"),
  studentName: z.string().nullable().optional(),
});

export const addSessionNoteIntentSchema = z.object({
  action: z.literal("ADD_SESSION_NOTE"),
  studentName: z.string().nullable().optional(),
  topic: z.string().optional(),
  classwork: z.string().optional(),
  homework: z.string().optional(),
  remarks: z.string().optional(),
});

export const aiActionSchema = z.discriminatedUnion("action", [
  recordAttendanceIntentSchema,
  createStudentIntentSchema,
  recordPaymentIntentSchema,
  queryStatsIntentSchema,
  deleteStudentIntentSchema,
  deleteSessionIntentSchema,
  startClassIntentSchema,
  endClassIntentSchema,
  addSessionNoteIntentSchema,
]);

export type AiAction = z.infer<typeof aiActionSchema>;

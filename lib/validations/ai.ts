import { z } from "zod";
import { AttendanceStatus } from "@/types/attendance";
import { PaymentMethod } from "@/types/payment";
import { FeeType } from "@/types/students";

export const aiSemanticOutputSchema = z.object({
  action: z.enum([
    "RECORD_ATTENDANCE",
    "RECORD_PAYMENT",
    "START_CLASS",
    "END_CLASS",
    "ADD_SESSION_NOTE",
    "CREATE_STUDENT",
    "DELETE_SESSION",
    "DELETE_STUDENT_REQUEST",
    "QUERY_STATS",
    "CORRECTION",
    "CONTEXT_SWITCH",
    "CLARIFY",
  ]),
  studentReference: z.string().nullable().optional(),
  dateReference: z.string().nullable().optional(),
  dates: z.array(z.string()).nullable().optional(),
  status: z.nativeEnum(AttendanceStatus).nullable().optional(),
  amount: z.number().nullable().optional(),
  method: z.nativeEnum(PaymentMethod).nullable().optional(),
  topic: z.string().nullable().optional(),
  classwork: z.string().nullable().optional(),
  homework: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
  queryTopic: z.enum(["PENDING_FEES", "REVENUE", "STUDENT_LIST", "TODAY_CLASSES", "SCHEDULE"]).nullable().optional(),
  name: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  fee: z.number().nullable().optional(),
  feeType: z.nativeEnum(FeeType).nullable().optional(),
  isCorrection: z.boolean().nullable().optional(),
  clarificationMessage: z.string().nullable().optional(),
  clarificationOptions: z.array(z.string()).nullable().optional(),
});

export type AiSemanticOutput = z.infer<typeof aiSemanticOutputSchema>;

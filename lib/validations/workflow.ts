import { z } from "zod";

import { AttendanceStatus } from "@/types/attendance";
import { BillingPeriod, PaymentMethod, PaymentStatus } from "@/types/payment";
import { SessionStatus } from "@/types/session";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");

export const attendanceInputSchema = z.object({
  sessionId: z.string().min(1),
  date,
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  status: z.enum([
    AttendanceStatus.PRESENT,
    AttendanceStatus.ABSENT,
    AttendanceStatus.CANCELLED,
    AttendanceStatus.RESCHEDULED,
  ]),
  notes: z.string().default(""),
});

export const sessionStatusInputSchema = z.object({
  sessionId: z.string().min(1),
  status: z.enum([
    SessionStatus.PLANNED,
    SessionStatus.IN_PROGRESS,
    SessionStatus.COMPLETED,
    SessionStatus.CANCELLED,
    SessionStatus.RESCHEDULED,
  ]),
});

export const paymentInputSchema = z.object({
  studentId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  amount: z.number().int().positive("Amount must be greater than zero."),
  date,
  method: z.enum([
    PaymentMethod.CASH,
    PaymentMethod.UPI,
    PaymentMethod.BANK_TRANSFER,
    PaymentMethod.CARD,
  ]),
  status: z.enum([
    PaymentStatus.PAID,
    PaymentStatus.PARTIAL,
    PaymentStatus.PENDING,
  ]),
  billingPeriod: z.enum([BillingPeriod.MONTHLY, BillingPeriod.CLASSWISE]),
  notes: z.string().default(""),
});

export type AttendanceInput = z.infer<typeof attendanceInputSchema>;
export type PaymentInput = z.infer<typeof paymentInputSchema>;

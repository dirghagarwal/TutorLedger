"use server";

import { revalidatePath } from "next/cache";

import { upsertAttendance } from "@/lib/repositories/attendance";
import { createPayment } from "@/lib/repositories/payments";
import { findSessionById, updateSessionStatus } from "@/lib/repositories/sessions";
import {
  attendanceInputSchema,
  paymentInputSchema,
  sessionStatusInputSchema,
} from "@/lib/validations/workflow";
import { AttendanceStatus, type Attendance } from "@/types/attendance";
import { PaymentStatus, type Payment } from "@/types/payment";
import { SessionStatus, type Session } from "@/types/session";
import { getSessionStatusForAttendance } from "@/lib/services/workflow";

type AttendanceResult = { ok: true; attendance: Attendance; session: Session } | { ok: false; error: string };
type PaymentResult = { ok: true; payment: Payment } | { ok: false; error: string };

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function revalidateWorkflow() {
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/students");
}

function calculateDurationMinutes(startedAt?: string | null, endedAt?: string | null): number | null {
  if (!startedAt || !endedAt) return null;
  const duration = Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 60000);
  return Math.max(1, duration);
}

export async function recordAttendance(input: unknown): Promise<AttendanceResult> {
  try {
    const values = attendanceInputSchema.parse(input);
    const session = await findSessionById(values.sessionId);
    if (!session) return { ok: false, error: "Session no longer exists." };

    const attendance = await upsertAttendance({
      id: `attendance-${values.sessionId}`,
      ...values,
    });
    const updatedSession = await updateSessionStatus(values.sessionId, getSessionStatusForAttendance(values.status as AttendanceStatus));
    revalidateWorkflow();
    revalidatePath(`/students/${session.studentId}`);
    return { ok: true, attendance, session: updatedSession };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "Unable to record attendance.") };
  }
}

export async function updateClassStatus(input: unknown): Promise<{ ok: true; session: Session } | { ok: false; error: string }> {
  try {
    const values = sessionStatusInputSchema.parse(input);
    const session = await updateSessionStatus(values.sessionId, values.status, {
      startedAt: values.startedAt ?? null,
      endedAt: values.status === SessionStatus.COMPLETED ? values.endedAt ?? null : null,
      durationMinutes:
        values.status === SessionStatus.COMPLETED
          ? values.durationMinutes ?? calculateDurationMinutes(values.startedAt, values.endedAt)
          : null,
    });
    revalidateWorkflow();
    revalidatePath(`/students/${session.studentId}`);
    return { ok: true, session };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "Unable to update class status.") };
  }
}

export async function recordPayment(input: unknown): Promise<PaymentResult> {
  try {
    const values = paymentInputSchema.parse(input);
    const payment = await createPayment({ id: crypto.randomUUID(), ...values, status: values.status as PaymentStatus });
    revalidateWorkflow();
    revalidatePath(`/students/${payment.studentId}`);
    return { ok: true, payment };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "Unable to record payment.") };
  }
}

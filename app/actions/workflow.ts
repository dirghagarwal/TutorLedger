"use server";

import { revalidatePath } from "next/cache";

import { upsertAttendance } from "@/lib/repositories/attendance";
import { createPayment, findPaymentById } from "@/lib/repositories/payments";
import { findSessionById, updateSessionStatus, upsertSession } from "@/lib/repositories/sessions";
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
type UpdateStatusResult = { ok: true; session: Session; warning?: string } | { ok: false; error: string };

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function revalidateWorkflow() {
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/students");
}

function calculateDurationMinutes(startedAt?: string | null, endedAt?: string | null): number | null {
  if (!startedAt || !endedAt) return null;
  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(endedAt);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
  const duration = Math.round((endMs - startMs) / 60000);
  return Math.max(1, duration);
}

export async function recordAttendance(input: unknown): Promise<AttendanceResult> {
  try {
    const values = attendanceInputSchema.parse(input);
    let session = await findSessionById(values.sessionId);

    // If session doesn't exist in DB yet (generated session), create it first
    if (!session && values.studentId && values.scheduleId) {
      session = await upsertSession({
        id: values.sessionId,
        studentId: values.studentId,
        scheduleId: values.scheduleId,
        date: values.date,
        startTime: values.startTime,
        endTime: values.endTime,
        status: getSessionStatusForAttendance(values.status as AttendanceStatus),
      });
    }

    if (!session) {
      return { ok: false, error: "Session record could not be found or created." };
    }

    const attendance = await upsertAttendance({
      id: `attendance-${values.sessionId}`,
      sessionId: values.sessionId,
      date: values.date,
      startTime: values.startTime,
      endTime: values.endTime,
      status: values.status as AttendanceStatus,
      notes: values.notes ?? "",
    });

    const nextStatus = getSessionStatusForAttendance(values.status as AttendanceStatus);
    await updateSessionStatus(values.sessionId, nextStatus, {}, {
      id: values.sessionId,
      studentId: session.studentId,
      scheduleId: session.scheduleId,
      date: values.date,
      startTime: values.startTime,
      endTime: values.endTime,
    });

    // Verification check on database persistence
    const verifiedSession = await findSessionById(values.sessionId);
    if (!verifiedSession) {
      return { ok: false, error: "Attendance was saved, but database session record verification failed." };
    }

    revalidateWorkflow();
    revalidatePath(`/students/${verifiedSession.studentId}`);
    return { ok: true, attendance, session: verifiedSession };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "Unable to record attendance.") };
  }
}

export async function updateClassStatus(input: unknown): Promise<UpdateStatusResult> {
  try {
    const values = sessionStatusInputSchema.parse(input);
    let session = await findSessionById(values.sessionId);

    // Upsert session if it's a virtual session not yet stored in DB
    if (!session && values.studentId && values.scheduleId) {
      session = await upsertSession({
        id: values.sessionId,
        studentId: values.studentId,
        scheduleId: values.scheduleId,
        date: values.date ?? new Date().toISOString().slice(0, 10),
        startTime: values.startTime ?? "09:00",
        endTime: values.endTime ?? "10:00",
        status: values.status,
      });
    }

    let startedAt = values.startedAt ?? session?.startedAt ?? null;
    let endedAt = values.endedAt ?? session?.endedAt ?? null;
    let durationMinutes = values.durationMinutes ?? session?.durationMinutes ?? null;
    let warning: string | undefined;

    if (values.status === SessionStatus.IN_PROGRESS) {
      startedAt = startedAt ?? new Date().toISOString();
    } else if (values.status === SessionStatus.COMPLETED) {
      endedAt = endedAt ?? new Date().toISOString();
      if (startedAt) {
        durationMinutes = calculateDurationMinutes(startedAt, endedAt);
      } else {
        durationMinutes = null;
        warning = "Class marked as completed, but started time was missing so duration was set to null.";
      }
    }

    await updateSessionStatus(
      values.sessionId,
      values.status,
      { startedAt, endedAt, durationMinutes },
      {
        id: values.sessionId,
        studentId: values.studentId ?? session?.studentId,
        scheduleId: values.scheduleId ?? session?.scheduleId,
        date: values.date ?? session?.date,
        startTime: values.startTime ?? session?.startTime,
        endTime: values.endTime ?? session?.endTime,
      }
    );

    // Database verification check
    const verified = await findSessionById(values.sessionId);
    if (!verified) {
      return { ok: false, error: "Class status update failed database verification." };
    }

    revalidateWorkflow();
    if (verified.studentId) revalidatePath(`/students/${verified.studentId}`);
    return { ok: true, session: verified, warning };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "Unable to update class status.") };
  }
}

export async function recordPayment(input: unknown): Promise<PaymentResult> {
  try {
    const values = paymentInputSchema.parse(input);
    const id = crypto.randomUUID();
    const payment = await createPayment({
      id,
      ...values,
      status: values.status as PaymentStatus,
    });

    // Verify persistence in DB
    const verified = await findPaymentById(id);
    if (!verified) {
      return { ok: false, error: "Payment recorded, but database verification failed." };
    }

    revalidateWorkflow();
    revalidatePath(`/students/${payment.studentId}`);
    return { ok: true, payment: verified };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "Unable to record payment.") };
  }
}

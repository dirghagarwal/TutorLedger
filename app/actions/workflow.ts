"use server";

import { revalidatePath } from "next/cache";

import { upsertAttendance } from "@/lib/repositories/attendance";
import { createPayment, findPaymentById } from "@/lib/repositories/payments";
import {
  ensureSessionExists,
  findSessionById,
  updateSessionStatus,
} from "@/lib/repositories/sessions";
import { getSessionStatusForAttendance } from "@/lib/services/workflow";
import {
  attendanceInputSchema,
  paymentInputSchema,
  sessionStatusInputSchema,
} from "@/lib/validations/workflow";
import { AttendanceStatus, type Attendance } from "@/types/attendance";
import { PaymentStatus, type Payment } from "@/types/payment";
import { SessionStatus, type Session } from "@/types/session";

type AttendanceResult = { ok: true; attendance: Attendance; session: Session } | { ok: false; error: string };
type PaymentResult = { ok: true; payment: Payment } | { ok: false; error: string };
type UpdateStatusResult = { ok: true; session: Session; warning?: string } | { ok: false; error: string };

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Intentionally ignore CLI context missing static store
  }
}

function revalidateWorkflow() {
  safeRevalidate("/");
  safeRevalidate("/calendar");
  safeRevalidate("/students");
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
    if (!session && values.studentId) {
      session = await ensureSessionExists({
        sessionId: values.sessionId,
        studentId: values.studentId,
        scheduleId: values.scheduleId,
        date: values.date,
        startTime: values.startTime,
        endTime: values.endTime,
      });
    }

    if (!session) {
      return { ok: false, error: "Session record could not be found or created." };
    }

    const attendance = await upsertAttendance({
      id: `attendance-${session.id}`,
      sessionId: session.id,
      date: values.date || session.date,
      startTime: values.startTime || session.startTime,
      endTime: values.endTime || session.endTime,
      status: values.status as AttendanceStatus,
      notes: values.notes ?? "",
    });

    const nextStatus = getSessionStatusForAttendance(values.status as AttendanceStatus);
    const updatedSession = await updateSessionStatus(
      session.id,
      nextStatus,
      {},
      {
        id: session.id,
        studentId: session.studentId,
        scheduleId: session.scheduleId,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
      }
    );

    revalidateWorkflow();
    safeRevalidate(`/students/${session.studentId}`);
    return { ok: true, attendance, session: updatedSession };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "Unable to record attendance.") };
  }
}

export async function updateClassStatus(input: unknown): Promise<UpdateStatusResult> {
  try {
    const values = sessionStatusInputSchema.parse(input);

    let session = await findSessionById(values.sessionId);
    if (!session && values.studentId) {
      session = await ensureSessionExists({
        sessionId: values.sessionId,
        studentId: values.studentId,
        scheduleId: values.scheduleId,
        date: values.date ?? new Date().toISOString().slice(0, 10),
        startTime: values.startTime ?? "09:00",
        endTime: values.endTime ?? "10:00",
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

    const updatedSession = await updateSessionStatus(
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

    revalidateWorkflow();
    if (updatedSession.studentId) safeRevalidate(`/students/${updatedSession.studentId}`);
    return { ok: true, session: updatedSession, warning };
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

    const verified = await findPaymentById(id);
    if (!verified) {
      return { ok: false, error: "Payment recorded, but database verification failed." };
    }

    revalidateWorkflow();
    safeRevalidate(`/students/${payment.studentId}`);
    return { ok: true, payment: verified };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "Unable to record payment.") };
  }
}

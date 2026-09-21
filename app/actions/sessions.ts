"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { recordAttendance, recordPayment } from "@/app/actions/workflow";
import { tenantPrisma } from "@/lib/db/tenant-prisma";
import { createAttachment } from "@/lib/repositories/attachments";
import { createSessionNote } from "@/lib/repositories/session-notes";
import { ensureSessionExists, findSessionById, upsertSession } from "@/lib/repositories/sessions";
import { logAiAuditTrail } from "@/lib/services/ai-safety";
import { getTodayDateKey } from "@/lib/utils/date";
import { sessionEditInputSchema, sessionNoteInputSchema, validateAttachmentFile } from "@/lib/validations/session";
import { AttachmentType } from "@/types/attachment";
import { AttendanceStatus } from "@/types/attendance";
import { PaymentMethod, PaymentStatus } from "@/types/payment";
import { SessionStatus } from "@/types/session";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Intentionally ignore CLI context missing static store
  }
}

function revalidateSessionPaths(sessionId: string, studentId?: string) {
  safeRevalidate("/calendar");
  safeRevalidate("/students");
  if (studentId) safeRevalidate(`/students/${studentId}`);
  if (sessionId) safeRevalidate(`/sessions/${sessionId}`);
  safeRevalidate("/reports");
  safeRevalidate("/");
}

export async function addSessionNote(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const values = sessionNoteInputSchema.parse(input);
    let session = await findSessionById(values.sessionId);
    if (!session && values.studentId && values.scheduleId) {
      session = await upsertSession({
        id: values.sessionId,
        studentId: values.studentId,
        scheduleId: values.scheduleId,
        date: values.date ?? getTodayDateKey(),
        startTime: values.startTime ?? "09:00",
        endTime: values.endTime ?? "10:00",
        status: SessionStatus.PLANNED,
      });
    }
    if (!session) return { ok: false, error: "Session record could not be found or created." };

    await createSessionNote({
      id: crypto.randomUUID(),
      sessionId: values.sessionId,
      topic: values.topic || "Session Notes",
      classwork: values.classwork,
      homework: values.homework,
      remarks: values.remarks,
    });
    revalidateSessionPaths(values.sessionId, session.studentId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to save session note." };
  }
}

export async function addSessionAttachment(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sessionId = String(formData.get("sessionId") ?? "");
    const studentId = String(formData.get("studentId") ?? "");
    const scheduleId = String(formData.get("scheduleId") ?? "");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file to upload." };

    const bytes = await file.arrayBuffer();
    const uint8 = new Uint8Array(bytes);

    const validation = validateAttachmentFile(file.name, file.type, file.size, uint8);
    if (!validation.valid) {
      return { ok: false, error: validation.error ?? "Invalid attachment file." };
    }

    let session = await findSessionById(sessionId);
    if (!session && studentId && scheduleId) {
      session = await upsertSession({
        id: sessionId,
        studentId,
        scheduleId,
        date: String(formData.get("date") ?? getTodayDateKey()),
        startTime: String(formData.get("startTime") ?? "09:00"),
        endTime: String(formData.get("endTime") ?? "10:00"),
        status: SessionStatus.PLANNED,
      });
    }
    if (!session) return { ok: false, error: "Session record could not be found or created." };

    const base64 = Buffer.from(bytes).toString("base64");
    const safeMime = file.type || "application/octet-stream";
    const storagePath = `data:${safeMime};base64,${base64}`;

    await createAttachment({
      id: crypto.randomUUID(),
      sessionId,
      type: validation.inferredType ?? AttachmentType.FILE,
      filename: file.name,
      storagePath,
    });
    revalidateSessionPaths(sessionId, session.studentId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to upload attachment." };
  }
}

export async function deleteSessionAction(sessionId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await findSessionById(sessionId);
    if (!session) {
      return { ok: false, error: "Session record not found." };
    }

    const paymentAllocations = await tenantPrisma.paymentAllocation.count({
      where: { sessionId },
    });
    if (paymentAllocations > 0) {
      return {
        ok: false,
        error: "Cannot delete a session with recorded payment allocations. Cancel the session or remove the payment allocation first.",
      };
    }

    const studentId = session.studentId;

    // Prisma Transaction: Delete ONLY session-level records
    await tenantPrisma.$transaction([
      tenantPrisma.attendance.deleteMany({ where: { sessionId } }),
      tenantPrisma.sessionNote.deleteMany({ where: { sessionId } }),
      tenantPrisma.attachment.deleteMany({ where: { sessionId } }),
      tenantPrisma.session.delete({ where: { id: sessionId } }),
    ]);

    // Safety Audit Check: Verify Student record is STILL intact
    const studentCheck = await tenantPrisma.student.findUnique({ where: { id: studentId } });
    if (!studentCheck) {
      throw new Error("CRITICAL SAFETY VIOLATION: Student record was affected during session delete!");
    }

    await logAiAuditTrail({
      action: "DELETE_SESSION",
      studentId,
      sessionId,
      resolvedDate: session.date,
      userPrompt: "Session deletion request",
      result: `SUCCESS: Session ${sessionId} deleted. Student ${studentCheck.name} & Schedules preserved intact.`,
    });

    revalidateSessionPaths(sessionId, studentId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to delete session." };
  }
}

export interface AddPastClassInput {
  studentId: string;
  scheduleId?: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AttendanceStatus;
  topic?: string;
  classwork?: string;
  homework?: string;
  remarks?: string;
  amount?: number;
}

export async function addPastClassAction(input: AddPastClassInput): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  try {
    const student = await tenantPrisma.student.findUnique({ where: { id: input.studentId } });
    if (!student) {
      return { ok: false, error: "Student record not found." };
    }

    // Application-level collision check before creating session, notes, attendance, or payments
    const existingCollision = await tenantPrisma.session.findFirst({
      where: {
        studentId: input.studentId,
        date: input.date,
        startTime: input.startTime,
      },
    });

    if (existingCollision) {
      return {
        ok: false,
        error: "A class for this student on this date and start time already exists.",
      };
    }

    const canonicalSession = await ensureSessionExists({
      studentId: input.studentId,
      scheduleId: input.scheduleId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
    });

    // Record Attendance
    await recordAttendance({
      sessionId: canonicalSession.id,
      studentId: input.studentId,
      scheduleId: canonicalSession.scheduleId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      status: input.status,
      notes: "Recorded via Add Past Class workflow",
    });

    // Add Session Notes if provided
    if (input.topic || input.classwork || input.homework || input.remarks) {
      await addSessionNote({
        sessionId: canonicalSession.id,
        studentId: input.studentId,
        scheduleId: canonicalSession.scheduleId,
        date: input.date,
        topic: input.topic || "Past Tuition Session",
        classwork: input.classwork || "",
        homework: input.homework || "",
        remarks: input.remarks || "",
      });
    }

    // Record payment if amount provided
    if (input.amount && input.amount > 0) {
      await recordPayment({
        studentId: input.studentId,
        sessionId: canonicalSession.id,
        amount: input.amount,
        date: input.date,
        method: PaymentMethod.UPI,
        status: PaymentStatus.PAID,
        billingPeriod: input.date.slice(0, 7),
        notes: "Historical payment",
      });
    }

    revalidateSessionPaths(canonicalSession.id, input.studentId);
    return { ok: true, sessionId: canonicalSession.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to add past class." };
  }
}

export interface MarkClassTakenInput {
  studentId: string;
  date: string;
  scheduleId?: string;
  startTime?: string;
  endTime?: string;
}

export async function markClassTakenFromProfile(
  input: MarkClassTakenInput
): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  try {
    const student = await tenantPrisma.student.findUnique({ where: { id: input.studentId } });
    if (!student) {
      return { ok: false, error: "Student record not found." };
    }

    const canonicalSession = await ensureSessionExists({
      studentId: input.studentId,
      date: input.date,
      scheduleId: input.scheduleId,
      startTime: input.startTime,
      endTime: input.endTime,
    });

    const attResult = await recordAttendance({
      sessionId: canonicalSession.id,
      studentId: input.studentId,
      scheduleId: canonicalSession.scheduleId,
      date: input.date,
      startTime: canonicalSession.startTime,
      endTime: canonicalSession.endTime,
      status: AttendanceStatus.PRESENT,
      notes: "Marked taken via Student Profile",
    });

    if (!attResult.ok) {
      return { ok: false, error: attResult.error };
    }

    revalidateSessionPaths(canonicalSession.id, input.studentId);
    return { ok: true, sessionId: canonicalSession.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to mark class taken." };
  }
}

export async function updateSessionAction(
  input: unknown
): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  try {
    const values = sessionEditInputSchema.parse(input);
    const session = await findSessionById(values.sessionId);
    if (!session) {
      return { ok: false, error: "Session record not found." };
    }

    const conflictingSession = await tenantPrisma.session.findFirst({
      where: {
        studentId: session.studentId,
        date: values.date,
        startTime: values.startTime,
        id: { not: session.id },
      },
      select: { id: true },
    });

    if (conflictingSession) {
      return {
        ok: false,
        error: "Another class for this student already uses that date and start time.",
      };
    }

    const isCancelling = values.status === SessionStatus.CANCELLED;
    const effectiveAttendanceStatus = isCancelling
      ? AttendanceStatus.CANCELLED
      : values.attendanceStatus;

    await tenantPrisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.session.update({
        where: { id: session.id },
        data: {
          date: values.date,
          startTime: values.startTime,
          endTime: values.endTime,
          status: values.status,
        },
      });

      const existingAttendance = await tx.attendance.findUnique({
        where: { sessionId: session.id },
      });

      if (existingAttendance) {
        await tx.attendance.update({
          where: { sessionId: session.id },
          data: {
            date: values.date,
            startTime: values.startTime,
            endTime: values.endTime,
            ...(effectiveAttendanceStatus ? { status: effectiveAttendanceStatus } : {}),
          },
        });
      } else if (effectiveAttendanceStatus) {
        await tx.attendance.create({
          data: {
            id: "attendance-" + session.id,
            sessionId: session.id,
            teacherId: "",
            date: values.date,
            startTime: values.startTime,
            endTime: values.endTime,
            status: effectiveAttendanceStatus,
            notes: isCancelling ? "Synchronized on session cancellation" : "Recorded via manual session edit",
          },
        });
      }
    });

    revalidateSessionPaths(session.id, session.studentId);
    return { ok: true, sessionId: session.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to update session." };
  }
}

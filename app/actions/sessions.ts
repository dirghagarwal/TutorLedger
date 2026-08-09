"use server";

import { revalidatePath } from "next/cache";

import { recordAttendance, recordPayment } from "@/app/actions/workflow";
import { prisma } from "@/lib/db/prisma";
import { createAttachment } from "@/lib/repositories/attachments";
import { createSessionNote } from "@/lib/repositories/session-notes";
import { ensureSessionExists, findSessionById, upsertSession } from "@/lib/repositories/sessions";
import { logAiAuditTrail } from "@/lib/services/ai-safety";
import { attachmentTypeSchema, sessionNoteInputSchema } from "@/lib/validations/session";
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

async function fileToStoragePath(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${file.type || "application/octet-stream"};base64,${base64}`;
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
        date: values.date ?? new Date().toISOString().slice(0, 10),
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
    const type = attachmentTypeSchema.parse(String(formData.get("type") ?? "FILE"));
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file to upload." };

    let session = await findSessionById(sessionId);
    if (!session && studentId && scheduleId) {
      session = await upsertSession({
        id: sessionId,
        studentId,
        scheduleId,
        date: String(formData.get("date") ?? new Date().toISOString().slice(0, 10)),
        startTime: String(formData.get("startTime") ?? "09:00"),
        endTime: String(formData.get("endTime") ?? "10:00"),
        status: SessionStatus.PLANNED,
      });
    }
    if (!session) return { ok: false, error: "Session record could not be found or created." };

    await createAttachment({
      id: crypto.randomUUID(),
      sessionId,
      type,
      filename: file.name,
      storagePath: await fileToStoragePath(file),
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

    const studentId = session.studentId;

    // Prisma Transaction: Delete ONLY session-level records
    await prisma.$transaction([
      prisma.attendance.deleteMany({ where: { sessionId } }),
      prisma.sessionNote.deleteMany({ where: { sessionId } }),
      prisma.attachment.deleteMany({ where: { sessionId } }),
      prisma.session.delete({ where: { id: sessionId } }),
    ]);

    // Safety Audit Check: Verify Student record is STILL intact
    const studentCheck = await prisma.student.findUnique({ where: { id: studentId } });
    if (!studentCheck) {
      throw new Error("CRITICAL SAFETY VIOLATION: Student record was affected during session delete!");
    }

    logAiAuditTrail({
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
    const student = await prisma.student.findUnique({ where: { id: input.studentId } });
    if (!student) {
      return { ok: false, error: "Student record not found." };
    }

    const canonicalSession = await ensureSessionExists({
      studentId: input.studentId,
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
        billingPeriod: new Date(input.date).toLocaleString("en-US", { month: "long", year: "numeric" }),
        notes: "Historical payment",
      });
    }

    revalidateSessionPaths(canonicalSession.id, input.studentId);
    return { ok: true, sessionId: canonicalSession.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to add past class." };
  }
}
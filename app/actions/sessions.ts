"use server";

import { revalidatePath } from "next/cache";

import { createAttachment } from "@/lib/repositories/attachments";
import { createSessionNote } from "@/lib/repositories/session-notes";
import { findSessionById, upsertSession } from "@/lib/repositories/sessions";
import { SessionStatus } from "@/types/session";
import { attachmentTypeSchema, sessionNoteInputSchema } from "@/lib/validations/session";

function revalidateSessionPaths(sessionId: string, studentId?: string) {
  revalidatePath("/calendar");
  revalidatePath("/students");
  if (studentId) revalidatePath(`/students/${studentId}`);
  if (sessionId) revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
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
"use server";

import { revalidatePath } from "next/cache";

import { createAttachment } from "@/lib/repositories/attachments";
import { createSessionNote } from "@/lib/repositories/session-notes";
import { findSessionById } from "@/lib/repositories/sessions";
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
    const session = await findSessionById(values.sessionId);
    if (!session) return { ok: false, error: "Session no longer exists." };
    await createSessionNote({ id: crypto.randomUUID(), ...values });
    revalidateSessionPaths(values.sessionId, session.studentId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to save session note." };
  }
}

export async function addSessionAttachment(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sessionId = String(formData.get("sessionId") ?? "");
    const type = attachmentTypeSchema.parse(String(formData.get("type") ?? "FILE"));
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file to upload." };
    const session = await findSessionById(sessionId);
    if (!session) return { ok: false, error: "Session no longer exists." };
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
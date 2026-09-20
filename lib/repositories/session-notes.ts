import { prisma } from "@/lib/db/prisma";
import { getRequestTeacherId } from "@/lib/auth/session";
import type { SessionNote } from "@/types/session-note";

function toSessionNote(record: Awaited<ReturnType<typeof prisma.sessionNote.findMany>>[number]): SessionNote {
  return { ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() };
}

export async function findSessionNotesBySessionIds(sessionIds: readonly string[]): Promise<SessionNote[]> {
  if (sessionIds.length === 0) return [];
  const records = await prisma.sessionNote.findMany({ where: { sessionId: { in: [...sessionIds] } }, orderBy: { createdAt: "desc" } });
  return records.map(toSessionNote);
}

export async function findSessionNotesBySession(sessionId: string): Promise<SessionNote[]> {
  const records = await prisma.sessionNote.findMany({ where: { sessionId }, orderBy: { createdAt: "desc" } });
  return records.map(toSessionNote);
}

export async function findSessionNotes(): Promise<SessionNote[]> {
  const records = await prisma.sessionNote.findMany({ orderBy: { createdAt: "desc" } });
  return records.map(toSessionNote);
}

export async function createSessionNote(input: Omit<SessionNote, "createdAt" | "updatedAt">): Promise<SessionNote> {
  const teacherId = await getRequestTeacherId();
  if (!teacherId) throw new Error("UNAUTHENTICATED");
  const record = await prisma.sessionNote.create({ data: { ...input, teacherId } as never });
  return toSessionNote(record);
}

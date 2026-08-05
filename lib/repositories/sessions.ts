import { prisma } from "@/lib/db/prisma";
import { SessionStatus, type Session } from "@/types/session";

function toSession(record: Awaited<ReturnType<typeof prisma.session.findMany>>[number]): Session {
  return { ...record, status: record.status as SessionStatus };
}

export async function findSessions(): Promise<Session[]> {
  const records = await prisma.session.findMany({ orderBy: [{ date: "asc" }, { startTime: "asc" }] });
  return records.map(toSession);
}

export async function findSessionsByStudent(studentId: string): Promise<Session[]> {
  const records = await prisma.session.findMany({ where: { studentId }, orderBy: [{ date: "desc" }, { startTime: "desc" }] });
  return records.map(toSession);
}

export async function findSessionById(id: string): Promise<Session | null> {
  const record = await prisma.session.findUnique({ where: { id } });
  return record ? toSession(record) : null;
}

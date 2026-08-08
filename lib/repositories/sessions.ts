import { prisma } from "@/lib/db/prisma";
import { SessionStatus, type Session } from "@/types/session";

export interface SessionUpdateData {
  startedAt?: string | null;
  endedAt?: string | null;
  durationMinutes?: number | null;
}

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

export interface SessionUpsertInput {
  id: string;
  studentId: string;
  scheduleId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  startedAt?: string | null;
  endedAt?: string | null;
  durationMinutes?: number | null;
}

export async function upsertSession(input: SessionUpsertInput): Promise<Session> {
  const record = await prisma.session.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      studentId: input.studentId,
      scheduleId: input.scheduleId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      status: input.status,
      startedAt: input.startedAt ?? null,
      endedAt: input.endedAt ?? null,
      durationMinutes: input.durationMinutes ?? null,
    },
    update: {
      status: input.status,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationMinutes: input.durationMinutes,
    },
  });
  return toSession(record);
}

export async function updateSessionStatus(
  id: string,
  status: SessionStatus,
  data: SessionUpdateData = {},
  fallbackSession?: Partial<SessionUpsertInput>
): Promise<Session> {
  const existing = await prisma.session.findUnique({ where: { id } });
  if (!existing && fallbackSession?.studentId && fallbackSession?.scheduleId) {
    return upsertSession({
      id,
      studentId: fallbackSession.studentId,
      scheduleId: fallbackSession.scheduleId,
      date: fallbackSession.date ?? new Date().toISOString().slice(0, 10),
      startTime: fallbackSession.startTime ?? "09:00",
      endTime: fallbackSession.endTime ?? "10:00",
      status,
      ...data,
    });
  }

  const record = await prisma.session.update({ where: { id }, data: { status, ...data } });
  return toSession(record);
}

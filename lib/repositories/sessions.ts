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

export interface EnsureSessionInput {
  sessionId?: string;
  studentId: string;
  scheduleId?: string;
  date: string;
  startTime?: string;
  endTime?: string;
}

export async function ensureSessionExists(input: EnsureSessionInput): Promise<Session> {
  // 1. Check if session already exists by exact ID
  if (input.sessionId) {
    const existingById = await findSessionById(input.sessionId);
    if (existingById) return existingById;
  }

  // 2. Check if session already exists for student + date (+ scheduleId if present)
  const existingRecords = await prisma.session.findMany({
    where: {
      studentId: input.studentId,
      date: input.date,
      ...(input.scheduleId ? { scheduleId: input.scheduleId } : {}),
    },
    orderBy: { startTime: "asc" },
  });

  if (existingRecords.length > 0 && existingRecords[0]) {
    return toSession(existingRecords[0]);
  }

  // 3. Resolve schedule details if scheduleId is not provided
  let scheduleId = input.scheduleId;
  let startTime = input.startTime ?? "16:30";
  let endTime = input.endTime ?? "17:30";

  if (!scheduleId) {
    const schedules = await prisma.schedule.findMany({
      where: { studentId: input.studentId, active: true },
    });
    if (schedules.length > 0 && schedules[0]) {
      scheduleId = schedules[0].id;
      startTime = schedules[0].startTime;
      endTime = schedules[0].endTime;
    } else {
      scheduleId = `sch-${input.studentId}`;
    }
  }

  const canonicalId = input.sessionId || `session-${input.studentId}-${input.date}`;

  return upsertSession({
    id: canonicalId,
    studentId: input.studentId,
    scheduleId,
    date: input.date,
    startTime,
    endTime,
    status: SessionStatus.PLANNED,
  });
}

export async function updateSessionStatus(
  id: string,
  status: SessionStatus,
  data: SessionUpdateData = {},
  fallbackSession?: Partial<SessionUpsertInput>
): Promise<Session> {
  const existing = await prisma.session.findUnique({ where: { id } });
  if (!existing && fallbackSession?.studentId) {
    const canonical = await ensureSessionExists({
      sessionId: id,
      studentId: fallbackSession.studentId,
      scheduleId: fallbackSession.scheduleId,
      date: fallbackSession.date ?? new Date().toISOString().slice(0, 10),
      startTime: fallbackSession.startTime,
      endTime: fallbackSession.endTime,
    });
    return upsertSession({
      id: canonical.id,
      studentId: canonical.studentId,
      scheduleId: canonical.scheduleId,
      date: canonical.date,
      startTime: canonical.startTime,
      endTime: canonical.endTime,
      status,
      ...data,
    });
  }

  const record = await prisma.session.update({ where: { id }, data: { status, ...data } });
  return toSession(record);
}

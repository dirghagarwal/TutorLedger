import { tenantPrisma } from "@/lib/db/tenant-prisma";
import { getTodayDateKey } from "@/lib/utils/date";
import { SessionStatus, type Session } from "@/types/session";

export interface SessionUpdateData {
  startedAt?: string | null;
  endedAt?: string | null;
  durationMinutes?: number | null;
}

function toSession(record: Awaited<ReturnType<typeof tenantPrisma.session.findMany>>[number]): Session {
  return { ...record, status: record.status as SessionStatus };
}

export async function findSessions(): Promise<Session[]> {
  const records = await tenantPrisma.session.findMany({ orderBy: [{ date: "asc" }, { startTime: "asc" }] });
  return records.map(toSession);
}

export async function findSessionsByStudent(studentId: string): Promise<Session[]> {
  const records = await tenantPrisma.session.findMany({ where: { studentId }, orderBy: [{ date: "desc" }, { startTime: "desc" }] });
  return records.map(toSession);
}

export async function findSessionById(id: string): Promise<Session | null> {
  const record = await tenantPrisma.session.findUnique({ where: { id } });
  return record ? toSession(record) : null;
}

export interface SessionUpsertInput {
  id: string; studentId: string; scheduleId: string; date: string; startTime: string; endTime: string;
  status: SessionStatus; startedAt?: string | null; endedAt?: string | null; durationMinutes?: number | null;
}

export async function upsertSession(input: SessionUpsertInput): Promise<Session> {
  const record = await tenantPrisma.session.upsert({
    where: { id: input.id },
    create: {
      id: input.id, studentId: input.studentId, scheduleId: input.scheduleId, date: input.date,
      startTime: input.startTime, endTime: input.endTime, status: input.status,
      startedAt: input.startedAt ?? null, endedAt: input.endedAt ?? null, durationMinutes: input.durationMinutes ?? null,
    } as never,
    update: { status: input.status, startedAt: input.startedAt, endedAt: input.endedAt, durationMinutes: input.durationMinutes },
  });
  return toSession(record);
}

export interface EnsureSessionInput {
  sessionId?: string; studentId: string; scheduleId?: string; date: string; startTime?: string; endTime?: string;
}

export async function ensureSessionExists(input: EnsureSessionInput): Promise<Session> {
  if (input.sessionId) {
    const existingById = await findSessionById(input.sessionId);
    if (existingById) return existingById;
  }

  let scheduleId = input.scheduleId;
  let startTime = input.startTime ?? "16:30";
  let endTime = input.endTime ?? "17:30";

  if (!scheduleId) {
    const schedules = await tenantPrisma.schedule.findMany({
      where: { studentId: input.studentId, active: true },
      orderBy: { startTime: "asc" },
    });
    if (schedules.length > 0 && schedules[0]) {
      scheduleId = schedules[0].id;
      if (!input.startTime) startTime = schedules[0].startTime;
      if (!input.endTime) endTime = schedules[0].endTime;
    } else {
      const adhocId = `sch-adhoc-${input.studentId}`;
      const existingAdhoc = await tenantPrisma.schedule.findUnique({
        where: { id: adhocId },
      });
      if (existingAdhoc) {
        scheduleId = existingAdhoc.id;
      } else {
        const student = await tenantPrisma.student.findUnique({
          where: { id: input.studentId },
          select: { subject: true },
        });
        const createdAdhoc = await tenantPrisma.schedule.create({
          data: {
            id: adhocId,
            studentId: input.studentId,
            dayOfWeek: "MONDAY",
            startTime: "00:00",
            endTime: "00:00",
            subject: student?.subject || "Ad-hoc Tuition",
            active: false,
          } as never,
        });
        scheduleId = createdAdhoc.id;
      }
    }
  }

  const canonicalId = input.sessionId || `session-${input.studentId}-${input.date}-${startTime.replace(/:/g, "")}`;
  const record = await tenantPrisma.session.upsert({
    where: {
      studentId_date_startTime: {
        studentId: input.studentId,
        date: input.date,
        startTime,
      },
    },
    create: {
      id: canonicalId, studentId: input.studentId, scheduleId, date: input.date,
      startTime, endTime, status: SessionStatus.PLANNED,
    } as never,
    update: {},
  });
  return toSession(record);
}

export async function updateSessionStatus(
  id: string,
  status: SessionStatus,
  data: SessionUpdateData = {},
  fallbackSession?: Partial<SessionUpsertInput>
): Promise<Session> {
  const existing = await tenantPrisma.session.findUnique({ where: { id } });
  if (!existing && fallbackSession?.studentId) {
    const canonical = await ensureSessionExists({
      sessionId: id, studentId: fallbackSession.studentId, scheduleId: fallbackSession.scheduleId,
      date: fallbackSession.date ?? getTodayDateKey(),
      startTime: fallbackSession.startTime, endTime: fallbackSession.endTime,
    });
    return upsertSession({
      id: canonical.id, studentId: canonical.studentId, scheduleId: canonical.scheduleId, date: canonical.date,
      startTime: canonical.startTime, endTime: canonical.endTime, status, ...data,
    });
  }
  const record = await tenantPrisma.session.update({ where: { id }, data: { status, ...data } });
  return toSession(record);
}

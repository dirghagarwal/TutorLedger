import { tenantPrisma } from "@/lib/db/tenant-prisma";
import { AttendanceStatus, type Attendance } from "@/types/attendance";

function toAttendance(record: Awaited<ReturnType<typeof tenantPrisma.attendance.findMany>>[number]): Attendance {
  return { ...record, status: record.status as AttendanceStatus };
}

export async function findAttendance(): Promise<Attendance[]> {
  const records = await tenantPrisma.attendance.findMany({ orderBy: [{ date: "desc" }, { startTime: "desc" }] });
  return records.map(toAttendance);
}

export async function findAttendanceBySessionIds(sessionIds: readonly string[]): Promise<Attendance[]> {
  if (sessionIds.length === 0) return [];
  const records = await tenantPrisma.attendance.findMany({ where: { sessionId: { in: [...sessionIds] } } });
  return records.map(toAttendance);
}

export async function findAttendanceBySession(sessionId: string): Promise<Attendance | null> {
  const record = await tenantPrisma.attendance.findUnique({ where: { sessionId } });
  return record ? toAttendance(record) : null;
}

export async function upsertAttendance(input: Attendance): Promise<Attendance> {
  const record = await tenantPrisma.attendance.upsert({
    where: { sessionId: input.sessionId },
    create: input as never,
    update: {
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      status: input.status,
      notes: input.notes,
    },
  });
  return toAttendance(record);
}

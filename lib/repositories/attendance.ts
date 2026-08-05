import { prisma } from "@/lib/db/prisma";
import { AttendanceStatus, type Attendance } from "@/types/attendance";

function toAttendance(record: Awaited<ReturnType<typeof prisma.attendance.findMany>>[number]): Attendance {
  return { ...record, status: record.status as AttendanceStatus };
}

export async function findAttendance(): Promise<Attendance[]> {
  const records = await prisma.attendance.findMany({ orderBy: [{ date: "desc" }, { startTime: "desc" }] });
  return records.map(toAttendance);
}

export async function findAttendanceBySessionIds(sessionIds: readonly string[]): Promise<Attendance[]> {
  if (sessionIds.length === 0) return [];
  const records = await prisma.attendance.findMany({ where: { sessionId: { in: [...sessionIds] } } });
  return records.map(toAttendance);
}

export async function findAttendanceBySession(sessionId: string): Promise<Attendance | null> {
  const record = await prisma.attendance.findUnique({ where: { sessionId } });
  return record ? toAttendance(record) : null;
}

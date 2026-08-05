import { prisma } from "@/lib/db/prisma";
import { DayOfWeek, type Schedule } from "@/types/schedule";

function toSchedule(record: Awaited<ReturnType<typeof prisma.schedule.findMany>>[number]): Schedule {
  return { ...record, dayOfWeek: record.dayOfWeek as DayOfWeek };
}

export async function findSchedules(): Promise<Schedule[]> {
  const records = await prisma.schedule.findMany({ orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] });
  return records.map(toSchedule);
}

export async function findSchedulesByStudent(studentId: string): Promise<Schedule[]> {
  const records = await prisma.schedule.findMany({ where: { studentId }, orderBy: { startTime: "asc" } });
  return records.map(toSchedule);
}

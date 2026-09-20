import { tenantPrisma } from "@/lib/db/tenant-prisma";
import { DayOfWeek, type Schedule } from "@/types/schedule";

function toSchedule(record: Awaited<ReturnType<typeof tenantPrisma.schedule.findMany>>[number]): Schedule {
  return { ...record, dayOfWeek: record.dayOfWeek as DayOfWeek };
}

export async function findSchedules(): Promise<Schedule[]> {
  const records = await tenantPrisma.schedule.findMany({ orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] });
  return records.map(toSchedule);
}

export async function findSchedulesByStudent(studentId: string): Promise<Schedule[]> {
  const records = await tenantPrisma.schedule.findMany({ where: { studentId }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] });
  return records.map(toSchedule);
}

export async function createSchedule(data: Omit<Schedule, "id"> & { id?: string; active?: boolean }): Promise<Schedule> {
    const record = await tenantPrisma.schedule.create({
    data: {
      id: data.id ?? crypto.randomUUID(),
      studentId: data.studentId,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      subject: data.subject,
      active: data.active ?? true,
      teacherId,
    } as never,
  });
  return toSchedule(record);
}

export async function updateSchedule(id: string, data: Partial<Omit<Schedule, "id">>): Promise<Schedule> {
  const record = await tenantPrisma.schedule.update({ where: { id }, data });
  return toSchedule(record);
}

export async function deleteSchedule(id: string): Promise<void> {
  await tenantPrisma.schedule.delete({ where: { id } });
}

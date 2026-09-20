import "server-only";
import { findSchedulesByStudent } from "@/lib/repositories/schedules";
import type { Schedule } from "@/types/schedule";

export async function getSchedulesForStudent(studentId: string): Promise<Schedule[]> {
  const records = await findSchedulesByStudent(studentId);
  return records.filter((schedule) => schedule.active).sort((first, second) => {
    const dayOrder = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
    const dayDifference = dayOrder.indexOf(first.dayOfWeek) - dayOrder.indexOf(second.dayOfWeek);
    const minutes = (value: string) => {
      const [hours, mins] = value.split(":").map(Number);
      return hours * 60 + mins;
    };
    return dayDifference || minutes(first.startTime) - minutes(second.startTime);
  });
}

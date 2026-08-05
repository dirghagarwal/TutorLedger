import { findSchedulesByStudent } from "@/lib/repositories/schedules";
import { DayOfWeek, type Schedule } from "@/types/schedule";

const dayOrder: readonly DayOfWeek[] = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

const dayLabels: Record<DayOfWeek, string> = {
  [DayOfWeek.SUNDAY]: "Sunday",
  [DayOfWeek.MONDAY]: "Monday",
  [DayOfWeek.TUESDAY]: "Tuesday",
  [DayOfWeek.WEDNESDAY]: "Wednesday",
  [DayOfWeek.THURSDAY]: "Thursday",
  [DayOfWeek.FRIDAY]: "Friday",
  [DayOfWeek.SATURDAY]: "Saturday",
};

export interface UpcomingClass {
  schedule: Schedule;
  date: string;
}

function getDayOfWeek(date: Date): DayOfWeek {
  return dayOrder[date.getDay()];
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function sortSchedules(first: Schedule, second: Schedule): number {
  const dayDifference =
    dayOrder.indexOf(first.dayOfWeek) - dayOrder.indexOf(second.dayOfWeek);
  return dayDifference || toMinutes(first.startTime) - toMinutes(second.startTime);
}

export async function getSchedulesForStudent(studentId: string): Promise<Schedule[]> {
  const records = await findSchedulesByStudent(studentId);
  return records.filter((schedule) => schedule.active).sort(sortSchedules);
}

export function getTodaysClasses(
  allSchedules: readonly Schedule[],
  date = new Date()
): Schedule[] {
  return allSchedules
    .filter(
      (schedule) =>
        schedule.active && schedule.dayOfWeek === getDayOfWeek(date)
    )
    .sort((first, second) => toMinutes(first.startTime) - toMinutes(second.startTime));
}

export function getThisWeeksSchedule(
  allSchedules: readonly Schedule[],
  date = new Date()
): Schedule[] {
  const todayIndex = date.getDay();
  return allSchedules
    .filter((schedule) => schedule.active)
    .sort((first, second) => {
      const firstOffset = (dayOrder.indexOf(first.dayOfWeek) - todayIndex + 7) % 7;
      const secondOffset =
        (dayOrder.indexOf(second.dayOfWeek) - todayIndex + 7) % 7;
      return firstOffset - secondOffset || toMinutes(first.startTime) - toMinutes(second.startTime);
    });
}

export function groupSchedulesByWeekday(
  allSchedules: readonly Schedule[]
): Record<DayOfWeek, Schedule[]> {
  return dayOrder.reduce<Record<DayOfWeek, Schedule[]>>((grouped, day) => {
    grouped[day] = allSchedules
      .filter((schedule) => schedule.active && schedule.dayOfWeek === day)
      .sort((first, second) => toMinutes(first.startTime) - toMinutes(second.startTime));
    return grouped;
  }, {
    [DayOfWeek.SUNDAY]: [],
    [DayOfWeek.MONDAY]: [],
    [DayOfWeek.TUESDAY]: [],
    [DayOfWeek.WEDNESDAY]: [],
    [DayOfWeek.THURSDAY]: [],
    [DayOfWeek.FRIDAY]: [],
    [DayOfWeek.SATURDAY]: [],
  });
}

export function getNextUpcomingClass(
  allSchedules: readonly Schedule[],
  now = new Date()
): UpcomingClass | null {
  const candidates: UpcomingClass[] = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    const day = getDayOfWeek(date);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    allSchedules
      .filter((schedule) => {
        const isToday = offset === 0;
        return (
          schedule.active &&
          schedule.dayOfWeek === day &&
          (!isToday || toMinutes(schedule.startTime) >= currentMinutes)
        );
      })
      .forEach((schedule) => candidates.push({ schedule, date: formatDate(date) }));
  }

  return candidates[0] ?? null;
}

export function formatWeeklySchedule(studentSchedules: readonly Schedule[]): string {
  return studentSchedules
    .map(
      (schedule) =>
        `${dayLabels[schedule.dayOfWeek]} · ${formatTime(schedule.startTime)}–${formatTime(schedule.endTime)}`
    )
    .join(" / ");
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function getDayLabel(day: DayOfWeek): string {
  return dayLabels[day];
}

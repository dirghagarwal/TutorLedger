import { findSchedules } from "@/lib/repositories/schedules";
import {
  findSessionById as findStoredSessionById,
  findSessions as findStoredSessions,
} from "@/lib/repositories/sessions";
import { DayOfWeek, type Schedule } from "@/types/schedule";
import { SessionStatus, type Session } from "@/types/session";

import { getDateKey } from "@/lib/utils/date";

const dayOrder: readonly DayOfWeek[] = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

function getDayOfWeek(date: Date): DayOfWeek {
  return dayOrder[date.getDay()];
}

function toDateKey(date: Date): string {
  return getDateKey(date);
}

export { getDateKey };

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function sortSessions(first: Session, second: Session): number {
  return `${first.date}T${first.startTime}`.localeCompare(
    `${second.date}T${second.startTime}`
  );
}

export function generateSessionsForMonth(
  year: number,
  month: number,
  recurringSchedules: readonly Schedule[]
): Session[] {
  const generated: Session[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const dateKey = toDateKey(date);
    recurringSchedules
      .filter(
        (schedule) =>
          schedule.active && schedule.dayOfWeek === getDayOfWeek(date)
      )
      .forEach((schedule) => {
        generated.push({
          id: `session-${dateKey}-${schedule.id}`,
          studentId: schedule.studentId,
          scheduleId: schedule.id,
          date: dateKey,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          status: SessionStatus.PLANNED,
        });
      });
  }

  return generated.sort(sortSessions);
}

export function generateSessionsForCurrentMonth(
  date: Date,
  recurringSchedules: readonly Schedule[]
): Session[] {
  return generateSessionsForMonth(date.getFullYear(), date.getMonth(), recurringSchedules);
}

export async function getAllSessions(
  date = new Date(),
  recurringSchedules?: readonly Schedule[]
): Promise<Session[]> {
  const [storedSessions, activeSchedules] = await Promise.all([
    findStoredSessions(),
    recurringSchedules ? Promise.resolve([...recurringSchedules]) : findSchedules(),
  ]);
  const combined = [
    ...generateSessionsForMonth(date.getFullYear(), date.getMonth(), activeSchedules),
    ...storedSessions,
  ];
  const uniqueSessions = new Map(
    combined.map((session) => [`${session.scheduleId}:${session.date}`, session])
  );
  return [...uniqueSessions.values()].sort(sortSessions);
}

export interface MonthCalendarDay {
  date: string | null;
  day: number | null;
}

export async function getSessionsForMonth(
  date = new Date(),
  recurringSchedules?: readonly Schedule[]
): Promise<Session[]> {
  const monthPrefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return (await getAllSessions(date, recurringSchedules)).filter((session) =>
    session.date.startsWith(monthPrefix)
  );
}

export function groupSessionsByDate(
  allSessions: readonly Session[]
): Record<string, Session[]> {
  return allSessions.reduce<Record<string, Session[]>>((grouped, session) => {
    grouped[session.date] ??= [];
    grouped[session.date].push(session);
    return grouped;
  }, {});
}

export interface SessionStatusGroups {
  upcoming: Session[];
  completed: Session[];
  cancelled: Session[];
}

export function groupSessionsByStatus(
  allSessions: readonly Session[]
): SessionStatusGroups {
  return allSessions.reduce<SessionStatusGroups>(
    (groups, session) => {
      if (session.status === SessionStatus.COMPLETED) groups.completed.push(session);
      else if (session.status === SessionStatus.CANCELLED) groups.cancelled.push(session);
      else groups.upcoming.push(session);
      return groups;
    },
    { upcoming: [], completed: [], cancelled: [] }
  );
}

export function getMonthCalendarDays(date = new Date()): MonthCalendarDay[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDayOffset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstDayOffset + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const day = index - firstDayOffset + 1;
    if (day < 1 || day > daysInMonth) return { date: null, day: null };
    return { date: toDateKey(new Date(year, month, day)), day };
  });
}

export async function getTodaysSessions(
  allSessions: readonly Session[] | undefined,
  date = new Date()
): Promise<Session[]> {
  const records = allSessions ?? (await getAllSessions(date));
  return records.filter((session) => session.date === toDateKey(date));
}

function getNowTimeKey(now = new Date()): string {
  const dateKey = toDateKey(now);
  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${dateKey}T${timeFormatter.format(now)}`;
}

export async function getUpcomingSessions(
  allSessions: readonly Session[] | undefined,
  now = new Date()
): Promise<Session[]> {
  const nowKey = getNowTimeKey(now);
  const records = allSessions ?? (await getAllSessions(now));
  return records
    .filter(
      (session) =>
        `${session.date}T${session.startTime}` >= nowKey &&
        session.status !== SessionStatus.CANCELLED &&
        session.status !== SessionStatus.COMPLETED
    )
    .sort(sortSessions);
}

export async function getPastSessions(
  allSessions: readonly Session[] | undefined,
  now = new Date()
): Promise<Session[]> {
  const nowKey = getNowTimeKey(now);
  const records = allSessions ?? (await getAllSessions(now));
  return records
    .filter((session) => `${session.date}T${session.startTime}` < nowKey)
    .sort((first, second) => sortSessions(second, first));
}

export async function getSessionsByStudent(
  studentId: string,
  allSessions?: readonly Session[]
): Promise<Session[]> {
  const records = allSessions ?? (await getAllSessions());
  return records
    .filter((session) => session.studentId === studentId)
    .sort((first, second) => sortSessions(second, first));
}

export async function getSessionById(
  sessionId: string,
  allSessions?: readonly Session[]
): Promise<Session | null> {
  if (!allSessions) return findStoredSessionById(sessionId);
  return allSessions.find((session) => session.id === sessionId) ?? null;
}

export async function getNextSession(
  allSessions: readonly Session[] | undefined,
  now = new Date()
): Promise<Session | null> {
  return (await getUpcomingSessions(allSessions, now))[0] ?? null;
}

export function getSessionDuration(session: Session): number {
  return toMinutes(session.endTime) - toMinutes(session.startTime);
}

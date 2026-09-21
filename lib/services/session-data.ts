import "server-only";
import { findSchedules } from "@/lib/repositories/schedules";
import { findSessions as findStoredSessions } from "@/lib/repositories/sessions";
import type { Schedule } from "@/types/schedule";
import type { Session } from "@/types/session";
import { generateSessionsForMonth, sortSessions } from "@/lib/services/sessions";

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
    combined.map((session) => [`${session.studentId}:${session.date}:${session.startTime}`, session])
  );
  return [...uniqueSessions.values()].sort(sortSessions);
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



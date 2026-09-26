"use server";

import { tenantPrisma } from "@/lib/db/tenant-prisma";
import { addScheduleAction, editScheduleAction } from "@/app/actions/schedule";
import { findStudents } from "@/lib/repositories/students";

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
function timeValue(value: string) { const m = value.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i); if (!m) return null; let h = Number(m[1]); const min = Number(m[2] ?? 0); const ap = m[3]?.toLowerCase(); if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0; return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`; }
function dayValue(text: string) { const d = DAYS.find((x) => text.toLowerCase().includes(x.toLowerCase())); return d ?? null; }

export async function processAiScheduleCommand(prompt: string): Promise<{ handled: boolean; ok?: boolean; message?: string }> {
  const text = prompt.trim();
  if (!/(schedule|permanent|every|move|reschedule|timing|time|class)/i.test(text)) return { handled: false };
  const students = await findStudents();
  const student = students.find((s) => text.toLowerCase().includes(s.name.toLowerCase())) ?? null;
  if (!student) return { handled: true, ok: false, message: "Which student should I change the schedule for?" };
  const day = dayValue(text);
  const timeMatch = text.match(/(?:at|to)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  const startTime = timeMatch ? timeValue(timeMatch[1]!) : null;
  if (/every|permanent|recurring/i.test(text) && day) {
    const active = await tenantPrisma.schedule.findMany({ where: { studentId: student.id, active: true }, orderBy: { startTime: "asc" } });
    const target = active[0];
    if (!target) {
      if (!startTime) return { handled: true, ok: false, message: `What time should ${student.name}'s ${day.toLowerCase()} class start?` };
      const endHour = Math.min(23, Number(startTime.slice(0, 2)) + 1); const endTime = `${String(endHour).padStart(2, "0")}:${startTime.slice(3)}`;
      const created = await addScheduleAction({ studentId: student.id, dayOfWeek: day, startTime, endTime, subject: student.subject, active: true });
      return { handled: true, ok: created.ok, message: created.ok ? `Added a permanent ${day.toLowerCase()} schedule for ${student.name} at ${startTime}.` : created.error };
    }
    const endTime = target.endTime; const updated = await editScheduleAction(target.id, { studentId: student.id, dayOfWeek: day, startTime: startTime ?? target.startTime, endTime, subject: target.subject, active: true });
    return { handled: true, ok: updated.ok, message: updated.ok ? `Updated ${student.name}'s recurring schedule to ${day.toLowerCase()}${startTime ? ` at ${startTime}` : ""}.` : updated.error };
  }
  if (day && startTime && /move|reschedule|change|timing|time/i.test(text)) {
    const active = await tenantPrisma.schedule.findMany({ where: { studentId: student.id, active: true }, orderBy: { startTime: "asc" } });
    const target = active[0]; if (!target) return { handled: true, ok: false, message: `No active recurring schedule found for ${student.name}.` };
    const updated = await editScheduleAction(target.id, { studentId: student.id, dayOfWeek: day, startTime, endTime: target.endTime, subject: target.subject, active: true });
    return { handled: true, ok: updated.ok, message: updated.ok ? `Rescheduled ${student.name}'s recurring class to ${day.toLowerCase()} at ${startTime}.` : updated.error };
  }
  return { handled: true, ok: false, message: "Tell me the student, weekday, and time, for example: 'Move Aahan permanently to Friday at 5 PM'." };
}

"use server";

import { tenantPrisma } from "@/lib/db/tenant-prisma";
import { addScheduleAction, editScheduleAction } from "@/app/actions/schedule";
import { findStudents } from "@/lib/repositories/students";

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
function timeValue(value: string) { const m = value.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i); if (!m) return null; let h = Number(m[1]); const min = Number(m[2] ?? 0); const ap = m[3]?.toLowerCase(); if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0; return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`; }
function dayValue(text: string) { return DAYS.find((x) => text.toLowerCase().includes(x.toLowerCase())) ?? null; }
export async function processAiScheduleCommand(prompt: string): Promise<{ handled: boolean; ok?: boolean; message?: string }> {
  const text = prompt.trim();
  if (!/(schedule|permanent|recurring|every|move|reschedule|change\s+(?:the\s+)?(?:schedule|timing|time))/i.test(text)) return { handled: false };
  const students = await findStudents(); const student = students.find((s) => text.toLowerCase().includes(s.name.toLowerCase())) ?? null;
  if (!student) return { handled: true, ok: false, message: "Which student should I change the schedule for?" };
  const day = dayValue(text); const timeMatch = text.match(/(?:at|to)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i); const startTime = timeMatch ? timeValue(timeMatch[1]!) : null;
  if (!day) return { handled: true, ok: false, message: `Which weekday should ${student.name}'s schedule use?` };
  const active = await tenantPrisma.schedule.findMany({ where: { studentId: student.id, active: true }, orderBy: { startTime: "asc" } }); const target = active[0];
  if (/every|permanent|recurring|move|reschedule|change/i.test(text)) {
    if (!target && !startTime) return { handled: true, ok: false, message: `What time should ${student.name}'s ${day.toLowerCase()} class start?` };
    const start = startTime ?? target!.startTime; const end = target?.endTime ?? `${String(Math.min(23, Number(start.slice(0, 2)) + 1)).padStart(2, "0")}:${start.slice(3)}`;
    const res = target ? await editScheduleAction(target.id, { studentId: student.id, dayOfWeek: day, startTime: start, endTime: end, subject: target.subject, active: true }) : await addScheduleAction({ studentId: student.id, dayOfWeek: day, startTime: start, endTime: end, subject: student.subject, active: true });
    return { handled: true, ok: res.ok, message: res.ok ? `${target ? "Updated" : "Added"} ${student.name}'s recurring ${day.toLowerCase()} class${start ? ` at ${start}` : ""}.` : res.error };
  }
  return { handled: true, ok: false, message: "Tell me the student, weekday, and time, for example: 'Move Aahan permanently to Friday at 5 PM'." };
}

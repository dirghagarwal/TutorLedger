"use server";

import { archiveStudent, editStudent } from "@/app/actions/students";
import { processAiScheduleCommand } from "@/app/actions/ai-schedule";
import { findStudents } from "@/lib/repositories/students";
import { FeeType } from "@/types/students";

export async function processAiPreflight(prompt: string): Promise<{ handled: boolean; ok?: boolean; message?: string }> {
  const schedule = await processAiScheduleCommand(prompt); if (schedule.handled) return schedule;
  const text = prompt.trim(); if (!/(archive|deactivate|activate|change|update|edit)\s+(?:student|fee|subject|billing|profile)/i.test(text)) return { handled: false };
  const students = await findStudents(); const student = students.find((s) => text.toLowerCase().includes(s.name.toLowerCase()));
  if (!student) return { handled: true, ok: false, message: "Which student profile should I update?" };
  if (/archive|deactivate/i.test(text)) { const res = await archiveStudent(student.id); return { handled: true, ok: res.ok, message: res.ok ? `${student.name} has been archived. Historical classes and payments are preserved.` : res.error }; }
  if (/activate/i.test(text)) { const res = await editStudent(student.id, { name: student.name, subject: student.subject, feeType: student.feeType as FeeType, fee: student.fee, active: true, color: student.color, billingStartMonth: student.billingStartMonth }); return { handled: true, ok: res.ok, message: res.ok ? `${student.name} is active again.` : res.error }; }
  const feeMatch = text.match(/(?:fee|fees)\s*(?:to|=|of)?\s*₹?\s*([\d,]+)/i); const subjectMatch = text.match(/subject\s*(?:to|=)\s*([A-Za-z][A-Za-z &-]{1,50})/i);
  const next = { name: student.name, subject: subjectMatch?.[1]?.trim() ?? student.subject, feeType: student.feeType as FeeType, fee: feeMatch ? Number(feeMatch[1]!.replace(/,/g, "")) : student.fee, active: student.active, color: student.color, billingStartMonth: student.billingStartMonth };
  const res = await editStudent(student.id, next); return { handled: true, ok: res.ok, message: res.ok ? `${student.name}'s profile was updated.` : res.error };
}

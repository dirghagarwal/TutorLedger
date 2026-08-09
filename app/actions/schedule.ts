"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createSchedule as repoCreateSchedule,
  deleteSchedule as repoDeleteSchedule,
  updateSchedule as repoUpdateSchedule,
} from "@/lib/repositories/schedules";
import { DayOfWeek } from "@/types/schedule";

const scheduleInputSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  dayOfWeek: z.nativeEnum(DayOfWeek),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Start time format must be HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "End time format must be HH:MM"),
  subject: z.string().trim().min(1, "Subject is required"),
  active: z.boolean().optional().default(true),
});

export async function addScheduleAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const values = scheduleInputSchema.parse(input);
    await repoCreateSchedule(values);

    revalidatePath("/students");
    revalidatePath(`/students/${values.studentId}`);
    revalidatePath("/calendar");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to save schedule.",
    };
  }
}

export async function editScheduleAction(
  id: string,
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const values = scheduleInputSchema.partial().parse(input);
    const updated = await repoUpdateSchedule(id, values);

    revalidatePath("/students");
    revalidatePath(`/students/${updated.studentId}`);
    revalidatePath("/calendar");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to update schedule.",
    };
  }
}

export async function removeScheduleAction(
  id: string,
  studentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await repoDeleteSchedule(id);

    revalidatePath("/students");
    revalidatePath(`/students/${studentId}`);
    revalidatePath("/calendar");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to delete schedule.",
    };
  }
}

"use server";

import { revalidatePath } from "next/cache";

import { tenantPrisma } from "@/lib/db/tenant-prisma";
import {
  createSchedule as repoCreateSchedule,
  deleteSchedule as repoDeleteSchedule,
  updateSchedule as repoUpdateSchedule,
} from "@/lib/repositories/schedules";
import { scheduleInputSchema } from "@/lib/validations/schedule";

export async function addScheduleAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const values = scheduleInputSchema.parse(input);

    const existingDuplicate = await tenantPrisma.schedule.findFirst({
      where: {
        studentId: values.studentId,
        dayOfWeek: values.dayOfWeek,
        startTime: values.startTime,
        active: true,
      },
      select: { id: true },
    });

    if (existingDuplicate) {
      return {
        ok: false,
        error: "An active schedule slot for this student at that day and start time already exists.",
      };
    }

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
    const values = scheduleInputSchema.parse(input);

    const existingDuplicate = await tenantPrisma.schedule.findFirst({
      where: {
        studentId: values.studentId,
        dayOfWeek: values.dayOfWeek,
        startTime: values.startTime,
        active: true,
        id: { not: id },
      },
      select: { id: true },
    });

    if (existingDuplicate) {
      return {
        ok: false,
        error: "Another active schedule slot for this student at that day and start time already exists.",
      };
    }

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
): Promise<{ ok: true; softDeactivated?: boolean } | { ok: false; error: string }> {
  try {
    const sessionCount = await tenantPrisma.session.count({
      where: { scheduleId: id },
    });

    if (sessionCount > 0) {
      // Soft-deactivate to prevent cascading deletion of historical sessions
      await repoUpdateSchedule(id, { active: false });
      revalidatePath("/students");
      revalidatePath(`/students/${studentId}`);
      revalidatePath("/calendar");
      revalidatePath("/");
      return { ok: true, softDeactivated: true };
    }

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

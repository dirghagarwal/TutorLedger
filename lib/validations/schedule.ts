import { z } from "zod";
import { DayOfWeek } from "@/types/schedule";

export const scheduleInputSchema = z
  .object({
    studentId: z.string().min(1, "Student ID is required"),
    dayOfWeek: z.nativeEnum(DayOfWeek),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Start time format must be HH:MM"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "End time format must be HH:MM"),
    subject: z.string().trim().min(1, "Subject is required"),
    active: z.boolean().optional().default(true),
  })
  .superRefine((values, ctx) => {
    const [startHour, startMinute] = values.startTime.split(":").map(Number);
    const [endHour, endMinute] = values.endTime.split(":").map(Number);
    if (endHour * 60 + endMinute <= startHour * 60 + startMinute) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "End time must be after start time.",
      });
    }
  });

export type ScheduleInput = z.infer<typeof scheduleInputSchema>;

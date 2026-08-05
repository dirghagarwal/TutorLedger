import { z } from "zod";

import { FeeType } from "@/types/students";

export const studentSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  subject: z.string().trim().min(2, "Subject must be at least 2 characters."),
  feeType: z.enum([FeeType.MONTHLY, FeeType.CLASSWISE]),
  fee: z.number().int().positive("Fee must be greater than zero."),
  active: z.boolean(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a valid color."),
});

export type StudentFormValues = z.infer<typeof studentSchema>;

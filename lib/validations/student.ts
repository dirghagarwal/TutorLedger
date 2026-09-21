import { z } from "zod";

import { FeeType } from "@/types/students";

export const studentSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  subject: z.string().trim().min(2, "Subject must be at least 2 characters."),
  feeType: z.enum([FeeType.MONTHLY, FeeType.CLASSWISE]),
  fee: z.number().int().positive("Fee must be greater than zero."),
  active: z.boolean(),
  color: z.string().regex(/^(?:#[0-9a-fA-F]{6}|hsl\([^)]*\))$/, "Choose a valid color."),
  billingStartMonth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, "Billing start month must be in YYYY-MM format.")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
});

export type StudentFormValues = z.infer<typeof studentSchema>;

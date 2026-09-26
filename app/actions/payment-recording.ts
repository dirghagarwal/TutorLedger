"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeacher } from "@/lib/auth/session";
import { tenantPrisma } from "@/lib/db/tenant-prisma";

const schema = z.object({ studentId: z.string().min(1), amount: z.number().int().positive(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), method: z.string().min(1), status: z.string().min(1), billingPeriod: z.enum(["MONTHLY", "CLASSWISE"]), coveredMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable().optional(), coveredFromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), coveredToDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), coveredClassCount: z.number().int().positive().nullable().optional(), notes: z.string().max(2000).default("") });

export async function recordPaymentWithCoverage(input: unknown) {
  const teacher = await requireTeacher();
  const values = schema.parse(input);
  if (values.billingPeriod === "MONTHLY" && !values.coveredMonth) throw new Error("Select the month covered by this monthly payment.");
  if (values.billingPeriod === "CLASSWISE" && (!values.coveredFromDate || !values.coveredToDate || !values.coveredClassCount)) throw new Error("Select the class-wise coverage dates and class count.");
  const student = await tenantPrisma.student.findFirst({ where: { id: values.studentId }, select: { id: true } });
  if (!student) return { ok: false as const, error: "Student not found." };
  const payment = await tenantPrisma.payment.create({ data: { id: crypto.randomUUID(), teacherId: teacher.id, studentId: values.studentId, amount: values.amount, date: values.date, method: values.method, status: values.status, billingPeriod: values.billingPeriod, coveredMonth: values.billingPeriod === "MONTHLY" ? values.coveredMonth ?? null : null, coveredFromDate: values.billingPeriod === "CLASSWISE" ? values.coveredFromDate ?? null : null, coveredToDate: values.billingPeriod === "CLASSWISE" ? values.coveredToDate ?? null : null, coveredClassCount: values.billingPeriod === "CLASSWISE" ? values.coveredClassCount ?? null : null, notes: values.notes } });
  revalidatePath("/payments"); revalidatePath(`/students/${values.studentId}`); revalidatePath("/calendar"); revalidatePath("/");
  return { ok: true as const, payment };
}

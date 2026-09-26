"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { tenantPrisma } from "@/lib/db/tenant-prisma";

const paymentEditSchema = z.object({
  paymentId: z.string().min(1), amount: z.number().int().positive(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), method: z.string().min(1), status: z.string().min(1), billingPeriod: z.enum(["MONTHLY", "CLASSWISE"]), coveredMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable().optional(), coveredFromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), coveredToDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), coveredClassCount: z.number().int().positive().nullable().optional(), notes: z.string().max(2000).default("")
});

export async function updatePaymentAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const values = paymentEditSchema.parse(input);
    const payment = await tenantPrisma.payment.findFirst({ where: { id: values.paymentId }, include: { allocations: { select: { amount: true } } } });
    if (!payment) return { ok: false, error: "Payment not found." };
    const allocated = payment.allocations.reduce((sum, row) => sum + row.amount, 0);
    if (values.amount < allocated) return { ok: false, error: `Amount cannot be below the ₹${allocated.toLocaleString("en-IN")} already allocated to classes.` };
    if (values.billingPeriod === "MONTHLY" && !values.coveredMonth) return { ok: false, error: "Select the month covered by this monthly payment." };
    if (values.billingPeriod === "CLASSWISE" && (!values.coveredFromDate || !values.coveredToDate || !values.coveredClassCount)) return { ok: false, error: "Select the class-wise coverage dates and class count." };
    await tenantPrisma.payment.update({ where: { id: payment.id }, data: { amount: values.amount, date: values.date, method: values.method, status: values.status, billingPeriod: values.billingPeriod, coveredMonth: values.billingPeriod === "MONTHLY" ? values.coveredMonth : null, coveredFromDate: values.billingPeriod === "CLASSWISE" ? values.coveredFromDate : null, coveredToDate: values.billingPeriod === "CLASSWISE" ? values.coveredToDate : null, coveredClassCount: values.billingPeriod === "CLASSWISE" ? values.coveredClassCount : null, notes: values.notes } });
    revalidatePath("/payments");
    revalidatePath(`/students/${payment.studentId}`);
    revalidatePath("/calendar");
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to update payment." }; }
}

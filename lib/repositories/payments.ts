import { prisma } from "@/lib/db/prisma";
import {
  BillingPeriod,
  PaymentMethod,
  PaymentStatus,
  type Payment,
} from "@/types/payment";

function toPayment(record: Awaited<ReturnType<typeof prisma.payment.findMany>>[number]): Payment {
  return {
    ...record,
    method: record.method as PaymentMethod,
    status: record.status as PaymentStatus,
    billingPeriod: record.billingPeriod as BillingPeriod,
  };
}

export async function findPayments(): Promise<Payment[]> {
  const records = await prisma.payment.findMany({ orderBy: { date: "desc" } });
  return records.map(toPayment);
}

export async function findPaymentsByStudent(studentId: string): Promise<Payment[]> {
  const records = await prisma.payment.findMany({ where: { studentId }, orderBy: { date: "desc" } });
  return records.map(toPayment);
}

export async function createPayment(input: Payment): Promise<Payment> {
  const record = await prisma.payment.create({ data: input });
  return toPayment(record);
}

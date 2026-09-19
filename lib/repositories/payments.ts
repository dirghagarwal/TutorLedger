import { prisma } from "@/lib/db/prisma";
import type { PaymentAllocation } from "@/types/payment-allocation";
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

export async function findPaymentById(id: string): Promise<Payment | null> {
  const record = await prisma.payment.findUnique({ where: { id } });
  return record ? toPayment(record) : null;
}

export async function createPayment(input: Payment): Promise<Payment> {
  const record = await prisma.payment.create({ data: input });
  return toPayment(record);
}


function toPaymentAllocation(record: Awaited<ReturnType<typeof prisma.paymentAllocation.findMany>>[number]): PaymentAllocation {
  return record;
}

export async function findPaymentAllocationsByPayment(paymentId: string): Promise<PaymentAllocation[]> {
  const records = await prisma.paymentAllocation.findMany({
    where: { paymentId },
    orderBy: { sessionId: "asc" },
  });
  return records.map(toPaymentAllocation);
}

export async function findPaymentAllocationsBySession(sessionId: string): Promise<PaymentAllocation[]> {
  const records = await prisma.paymentAllocation.findMany({
    where: { sessionId },
    orderBy: { paymentId: "asc" },
  });
  return records.map(toPaymentAllocation);
}

export async function createPaymentAllocation(input: PaymentAllocation): Promise<PaymentAllocation> {
  const record = await prisma.paymentAllocation.create({ data: input });
  return toPaymentAllocation(record);
}

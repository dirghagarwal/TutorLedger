import { Prisma } from "@prisma/client";
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


export async function createPaymentWithAllocations(
  input: Payment,
  allocations: PaymentAllocation[],
): Promise<Payment> {
  const record = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (input.sessionId) {
      const directSession = await tx.session.findUnique({
        where: { id: input.sessionId },
        select: { studentId: true },
      });
      if (!directSession) {
        throw new Error("The payment session could not be found.");
      }
      if (directSession.studentId !== input.studentId) {
        throw new Error("The payment session does not belong to this student.");
      }
    }

    if (allocations.length > 0) {
      const uniqueSessionIds = new Set(allocations.map((allocation) => allocation.sessionId));
      if (uniqueSessionIds.size !== allocations.length) {
        throw new Error("A payment cannot allocate the same session more than once.");
      }

      const sessions = await tx.session.findMany({
        where: {
          id: { in: allocations.map((allocation) => allocation.sessionId) },
          studentId: input.studentId,
        },
        select: { id: true },
      });
      if (sessions.length !== uniqueSessionIds.size) {
        throw new Error("One or more payment allocations do not belong to this student.");
      }

      const allocatedTotal = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
      if (allocatedTotal > input.amount) {
        throw new Error("Allocated class amounts cannot exceed the payment amount.");
      }
    }

    const payment = await tx.payment.create({ data: input });
    if (allocations.length > 0) {
      await tx.paymentAllocation.createMany({
        data: allocations.map((allocation) => ({
          id: allocation.id,
          paymentId: payment.id,
          sessionId: allocation.sessionId,
          amount: allocation.amount,
        })),
      });
    }
    return payment;
  });
  return toPayment(record);
}


export async function findPaymentAllocationsBySessionIds(sessionIds: string[]): Promise<PaymentAllocation[]> {
  if (sessionIds.length === 0) return [];
  const records = await prisma.paymentAllocation.findMany({
    where: { sessionId: { in: sessionIds } },
    orderBy: [{ sessionId: "asc" }, { paymentId: "asc" }],
  });
  return records.map(toPaymentAllocation);
}

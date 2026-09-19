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
  return createPaymentWithAllocations(input, []);
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
      const linkedSession = await tx.session.findUnique({
        where: { id: input.sessionId },
        select: { id: true, studentId: true },
      });
      if (!linkedSession || linkedSession.studentId !== input.studentId) {
        throw new Error("Payment session does not belong to this student.");
      }
    }

    let effectiveAllocations = allocations;

    if (input.status === PaymentStatus.PENDING && effectiveAllocations.length > 0) {
      throw new Error("Pending payments cannot be allocated as collected class payments.");
    }

    if (effectiveAllocations.length > 0) {
      const requestedSessionIds = effectiveAllocations.map((allocation) => allocation.sessionId);
      const uniqueSessionIds = new Set(requestedSessionIds);
      if (uniqueSessionIds.size !== requestedSessionIds.length) {
        throw new Error("A payment cannot allocate the same class more than once.");
      }

      const sessions = await tx.session.findMany({
        where: {
          id: { in: requestedSessionIds },
          studentId: input.studentId,
        },
        select: { id: true },
      });
      if (sessions.length !== effectiveAllocations.length) {
        throw new Error("One or more payment allocations do not belong to this student.");
      }

      const allocatedTotal = effectiveAllocations.reduce(
        (sum, allocation) => sum + allocation.amount,
        0
      );
      if (allocatedTotal > input.amount) {
        throw new Error("Allocated class amounts cannot exceed the payment amount.");
      }
    } else if (
      input.billingPeriod === BillingPeriod.CLASSWISE &&
      (input.status === PaymentStatus.PAID || input.status === PaymentStatus.PARTIAL)
    ) {
      const student = await tx.student.findUnique({
        where: { id: input.studentId },
        select: { fee: true },
      });

      if (student) {
        const candidateSessions = await tx.session.findMany({
          where: {
            studentId: input.studentId,
            attendance: { is: { status: "PRESENT" } },
            ...(input.sessionId ? { id: input.sessionId } : {}),
          },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
          select: { id: true, date: true, startTime: true },
        });

        const candidateIds = candidateSessions.map((session) => session.id);
        const previous = candidateIds.length
          ? await tx.paymentAllocation.groupBy({
              by: ["sessionId"],
              where: { sessionId: { in: candidateIds } },
              _sum: { amount: true },
            })
          : [];

        const previouslyAllocated = new Map(
          previous.map((item) => [item.sessionId, item._sum.amount ?? 0])
        );

        let remaining = input.amount;
        const generated: PaymentAllocation[] = [];
        for (const session of candidateSessions) {
          if (remaining <= 0) break;
          const alreadyCovered = previouslyAllocated.get(session.id) ?? 0;
          const sessionDue = Math.max(0, student.fee - alreadyCovered);
          const allocationAmount = Math.min(remaining, sessionDue);
          if (allocationAmount > 0) {
            generated.push({
              id: crypto.randomUUID(),
              paymentId: input.id,
              sessionId: session.id,
              amount: allocationAmount,
            });
            remaining -= allocationAmount;
          }
        }
        effectiveAllocations = generated;
      }
    }

    const payment = await tx.payment.create({ data: input });
    if (effectiveAllocations.length > 0) {
      await tx.paymentAllocation.createMany({
        data: effectiveAllocations.map((allocation) => ({
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

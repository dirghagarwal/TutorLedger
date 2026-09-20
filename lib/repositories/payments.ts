import { getRequestTeacherId } from "@/lib/auth/session";
import { tenantPrisma } from "@/lib/db/tenant-prisma";
import type { PaymentAllocation } from "@/types/payment-allocation";
import { BillingPeriod, PaymentMethod, PaymentStatus, type Payment } from "@/types/payment";

function toPayment(record: Awaited<ReturnType<typeof tenantPrisma.payment.findMany>>[number]): Payment {
  return { ...record, method: record.method as PaymentMethod, status: record.status as PaymentStatus, billingPeriod: record.billingPeriod as BillingPeriod };
}

export async function findPayments(): Promise<Payment[]> {
  const records = await tenantPrisma.payment.findMany({ orderBy: { date: "desc" } });
  return records.map(toPayment);
}

export async function findPaymentsByStudent(studentId: string): Promise<Payment[]> {
  const records = await tenantPrisma.payment.findMany({ where: { studentId }, orderBy: { date: "desc" } });
  return records.map(toPayment);
}

export async function findPaymentById(id: string): Promise<Payment | null> {
  const record = await tenantPrisma.payment.findUnique({ where: { id } });
  return record ? toPayment(record) : null;
}

export async function createPayment(input: Payment): Promise<Payment> {
  return createPaymentWithAllocations(input, []);
}

function toPaymentAllocation(record: Awaited<ReturnType<typeof tenantPrisma.paymentAllocation.findMany>>[number]): PaymentAllocation {
  return record;
}

export async function findPaymentAllocationsByPayment(paymentId: string): Promise<PaymentAllocation[]> {
  const records = await tenantPrisma.paymentAllocation.findMany({ where: { paymentId }, orderBy: { sessionId: "asc" } });
  return records.map(toPaymentAllocation);
}

export async function findPaymentAllocationsBySession(sessionId: string): Promise<PaymentAllocation[]> {
  const records = await tenantPrisma.paymentAllocation.findMany({ where: { sessionId }, orderBy: { paymentId: "asc" } });
  return records.map(toPaymentAllocation);
}

export async function createPaymentAllocation(input: PaymentAllocation): Promise<PaymentAllocation> {
  const teacherId = await getRequestTeacherId();
  if (!teacherId) throw new Error("UNAUTHENTICATED");
  const record = await tenantPrisma.paymentAllocation.create({ data: { ...input, teacherId } as never });
  return toPaymentAllocation(record);
}

export async function createPaymentWithAllocations(input: Payment, allocations: PaymentAllocation[]): Promise<Payment> {
  const teacherId = await getRequestTeacherId();
  if (!teacherId) throw new Error("UNAUTHENTICATED");

  const record = await tenantPrisma.$transaction(async (tx) => {
    if (input.sessionId) {
      const linkedSession = await tx.session.findUnique({
        where: { id: input.sessionId, teacherId },
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
        where: { id: { in: requestedSessionIds }, studentId: input.studentId, teacherId },
        select: { id: true },
      });
      if (sessions.length !== effectiveAllocations.length) {
        throw new Error("One or more payment allocations do not belong to this student.");
      }

      const allocatedTotal = effectiveAllocations.reduce((sum, allocation) => sum + allocation.amount, 0);
      if (allocatedTotal > input.amount) throw new Error("Allocated class amounts cannot exceed the payment amount.");
    } else if (
      input.billingPeriod === BillingPeriod.CLASSWISE &&
      (input.status === PaymentStatus.PAID || input.status === PaymentStatus.PARTIAL)
    ) {
      const student: { fee: number } | null = await tx.student.findUnique({
        where: { id: input.studentId, teacherId },
        select: { fee: true },
      });

      if (student) {
        const candidateSessions: Array<{ id: string; date: string; startTime: string }> = await tx.session.findMany({
          where: {
            studentId: input.studentId,
            teacherId,
            attendance: { is: { status: "PRESENT" } },
            ...(input.sessionId ? { id: input.sessionId } : {}),
          },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
          select: { id: true, date: true, startTime: true },
        });

        const candidateIds = candidateSessions.map((session) => session.id);
        const previousAllocations = candidateIds.length
          ? await tx.paymentAllocation.findMany({
              where: { sessionId: { in: candidateIds }, teacherId },
              select: { sessionId: true, amount: true },
            })
          : [];

        const previouslyAllocated = new Map<string, number>();
        for (const allocation of previousAllocations) {
          previouslyAllocated.set(allocation.sessionId, (previouslyAllocated.get(allocation.sessionId) ?? 0) + allocation.amount);
        }

        let remaining = input.amount;
        const generated: PaymentAllocation[] = [];
        for (const session of candidateSessions) {
          if (remaining <= 0) break;
          const alreadyCovered = previouslyAllocated.get(session.id) ?? 0;
          const sessionDue = Math.max(0, student.fee - alreadyCovered);
          const allocationAmount = Math.min(remaining, sessionDue);
          if (allocationAmount > 0) {
            generated.push({ id: crypto.randomUUID(), paymentId: input.id, sessionId: session.id, amount: allocationAmount });
            remaining -= allocationAmount;
          }
        }
        effectiveAllocations = generated;
      }
    }

    const payment = await tx.payment.create({ data: { ...input, teacherId } });
    if (effectiveAllocations.length > 0) {
      await tx.paymentAllocation.createMany({
        data: effectiveAllocations.map((allocation) => ({
          id: allocation.id,
          paymentId: payment.id,
          sessionId: allocation.sessionId,
          amount: allocation.amount,
          teacherId,
        })),
      });
    }
    return payment;
  });
  return toPayment(record);
}

export async function findPaymentAllocationsBySessionIds(sessionIds: string[]): Promise<PaymentAllocation[]> {
  if (sessionIds.length === 0) return [];
  const records = await tenantPrisma.paymentAllocation.findMany({
    where: { sessionId: { in: sessionIds } },
    orderBy: [{ sessionId: "asc" }, { paymentId: "asc" }],
  });
  return records.map(toPaymentAllocation);
}

import { findPayments } from "@/lib/repositories/payments";
import { findStudents } from "@/lib/repositories/students";
import {
  PaymentStatus,
  type Payment,
} from "@/types/payment";
import type { Student } from "@/types/students";

function isCollected(payment: Payment): boolean {
  return (
    payment.status === PaymentStatus.PAID ||
    payment.status === PaymentStatus.PARTIAL
  );
}

function isSameMonth(date: string, reference: Date): boolean {
  const paymentDate = new Date(`${date}T00:00:00`);
  return (
    paymentDate.getFullYear() === reference.getFullYear() &&
    paymentDate.getMonth() === reference.getMonth()
  );
}

function isSameYear(date: string, reference: Date): boolean {
  return new Date(`${date}T00:00:00`).getFullYear() === reference.getFullYear();
}

function sumPayments(records: readonly Payment[]): number {
  return records.reduce((total, payment) => total + payment.amount, 0);
}

async function resolvePayments(
  allPayments?: readonly Payment[]
): Promise<Payment[]> {
  return allPayments ? [...allPayments] : findPayments();
}

export async function getPaymentHistory(
  studentId: string,
  allPayments?: readonly Payment[]
): Promise<Payment[]> {
  const records = await resolvePayments(allPayments);
  return records
    .filter((payment) => payment.studentId === studentId)
    .sort((first, second) => second.date.localeCompare(first.date));
}

export async function getOutstandingBalance(
  studentId: string,
  allPayments?: readonly Payment[]
): Promise<number> {
  const records = await resolvePayments(allPayments);
  return sumPayments(
    records.filter(
      (payment) =>
        payment.studentId === studentId && payment.status === PaymentStatus.PENDING
    )
  );
}

export async function getRevenueThisMonth(
  allPayments?: readonly Payment[],
  reference = new Date()
): Promise<number> {
  const records = await resolvePayments(allPayments);
  return sumPayments(
    records.filter(
      (payment) => isCollected(payment) && isSameMonth(payment.date, reference)
    )
  );
}

export async function getRevenueThisYear(
  allPayments?: readonly Payment[],
  reference = new Date()
): Promise<number> {
  const records = await resolvePayments(allPayments);
  return sumPayments(
    records.filter(
      (payment) => isCollected(payment) && isSameYear(payment.date, reference)
    )
  );
}

export async function getRevenueByStudent(
  studentId: string,
  allPayments?: readonly Payment[]
): Promise<number> {
  const records = await resolvePayments(allPayments);
  return sumPayments(
    records.filter(
      (payment) => payment.studentId === studentId && isCollected(payment)
    )
  );
}

export async function getPendingStudents(
  allStudents?: readonly Student[],
  allPayments?: readonly Payment[]
): Promise<Student[]> {
  const [studentRecords, paymentRecords] = await Promise.all([
    allStudents ? Promise.resolve([...allStudents]) : findStudents(),
    resolvePayments(allPayments),
  ]);
  return studentRecords.filter(
    (student) =>
      paymentRecords.some(
        (payment) =>
          payment.studentId === student.id &&
          payment.status === PaymentStatus.PENDING
      )
  );
}

export async function getLifetimePayments(
  studentId: string,
  allPayments?: readonly Payment[]
): Promise<number> {
  return getRevenueByStudent(studentId, allPayments);
}

export async function getRecentPayment(
  studentId: string,
  allPayments?: readonly Payment[]
): Promise<Payment | null> {
  return (await getPaymentHistory(studentId, allPayments)).find(isCollected) ?? null;
}

export async function getTotalOutstandingBalance(
  allStudents?: readonly Student[],
  allPayments?: readonly Payment[]
): Promise<number> {
  const [studentRecords, paymentRecords] = await Promise.all([
    allStudents ? Promise.resolve([...allStudents]) : findStudents(),
    resolvePayments(allPayments),
  ]);
  return studentRecords.reduce(
    (total, student) =>
      total +
      sumPayments(
        paymentRecords.filter(
          (payment) =>
            payment.studentId === student.id &&
            payment.status === PaymentStatus.PENDING
        )
      ),
    0
  );
}

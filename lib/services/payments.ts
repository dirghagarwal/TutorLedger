import { findAttendance } from "@/lib/repositories/attendance";
import { findPayments } from "@/lib/repositories/payments";
import { findSessions } from "@/lib/repositories/sessions";
import { findStudentById, findStudents } from "@/lib/repositories/students";
import { AttendanceStatus, type Attendance } from "@/types/attendance";
import { PaymentStatus, type Payment } from "@/types/payment";
import { FeeType, type Student } from "@/types/students";
import { getDateKey, getTodayDateKey } from "@/lib/utils/date";
import type { Session } from "@/types/session";

function isCollected(payment: Payment): boolean {
  return (
    payment.status === PaymentStatus.PAID ||
    payment.status === PaymentStatus.PARTIAL
  );
}

function sumPayments(records: readonly Payment[]): number {
  return records.reduce((total, payment) => total + payment.amount, 0);
}

async function resolvePayments(
  allPayments?: readonly Payment[]
): Promise<Payment[]> {
  return allPayments ? [...allPayments] : findPayments();
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function currentMonthKey(): string {
  return getTodayDateKey().slice(0, 7);
}

function addMonth(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1 + 1, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function listMonthsInclusive(startKey: string, endKey: string): string[] {
  const months: string[] = [];
  let cursor = startKey;
  while (cursor <= endKey) {
    months.push(cursor);
    const next = addMonth(cursor);
    if (next === cursor) break;
    cursor = next;
  }
  return months;
}

function getEarliestBillingMonth(
  studentId: string,
  payments: readonly Payment[],
  sessions: readonly Session[]
): string {
  const evidence = [
    ...payments
      .filter((payment) => payment.studentId === studentId && isCollected(payment))
      .map((payment) => monthKey(payment.date)),
    ...sessions
      .filter((session) => session.studentId === studentId)
      .map((session) => monthKey(session.date)),
  ].sort();

  const current = currentMonthKey();
  const earliest = evidence[0];
  return earliest && earliest <= current ? earliest : current;
}

export interface BalanceBreakdown {
  outstanding: number;
  credit: number;
  accrued: number;
  collected: number;
}

function calculateMonthlyBalance(
  studentId: string,
  fee: number,
  payments: readonly Payment[],
  sessions: readonly Session[],
): BalanceBreakdown {
  const endKey = currentMonthKey();
  const startKey = getEarliestBillingMonth(studentId, payments, sessions);
  const dueMonths = listMonthsInclusive(startKey, endKey);
  const accrued = dueMonths.length * fee;
  const collected = sumPayments(
    payments.filter((payment) => payment.studentId === studentId && isCollected(payment))
  );

  return {
    outstanding: Math.max(0, accrued - collected),
    credit: Math.max(0, collected - accrued),
    accrued,
    collected,
  };
}

function calculateClasswiseBalance(
  studentId: string,
  fee: number,
  payments: readonly Payment[],
  sessions: readonly Session[],
  attendance: readonly Attendance[],
): BalanceBreakdown {
  const studentSessionIds = new Set(
    sessions
      .filter((session) => session.studentId === studentId)
      .map((session) => session.id)
  );

  const attendedCount = attendance.filter(
    (record) =>
      studentSessionIds.has(record.sessionId) &&
      record.status === AttendanceStatus.PRESENT
  ).length;

  const accrued = attendedCount * fee;
  const collected = sumPayments(
    payments.filter((payment) => payment.studentId === studentId && isCollected(payment))
  );

  return {
    outstanding: Math.max(0, accrued - collected),
    credit: Math.max(0, collected - accrued),
    accrued,
    collected,
  };
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

export async function getBalanceBreakdown(
  studentId: string,
  allPayments?: readonly Payment[],
  allStudents?: readonly Student[],
  allSessions?: readonly Session[],
  allAttendance?: readonly Attendance[],
): Promise<BalanceBreakdown> {
  const records = await resolvePayments(allPayments);
  const student = allStudents
    ? allStudents.find((current) => current.id === studentId)
    : await findStudentById(studentId);

  if (!student) {
    return {
      outstanding: 0,
      credit: 0,
      accrued: 0,
      collected: 0,
    };
  }

  if (student.feeType === FeeType.CLASSWISE) {
    const [sessions, attendance] = await Promise.all([
      allSessions ? Promise.resolve([...allSessions]) : findSessions(),
      allAttendance ? Promise.resolve([...allAttendance]) : findAttendance(),
    ]);
    return calculateClasswiseBalance(
      studentId,
      student.fee,
      records,
      sessions,
      attendance,
    );
  }

  const sessions = allSessions
    ? [...allSessions]
    : await findSessions();

  return calculateMonthlyBalance(
    studentId,
    student.fee,
    records,
    sessions,
  );
}

export async function getOutstandingBalance(
  studentId: string,
  allPayments?: readonly Payment[],
  allStudents?: readonly Student[],
  allSessions?: readonly Session[],
  allAttendance?: readonly Attendance[]
): Promise<number> {
  const breakdown = await getBalanceBreakdown(
    studentId,
    allPayments,
    allStudents,
    allSessions,
    allAttendance,
  );
  return breakdown.outstanding;
}

export async function getRevenueThisMonth(
  allPayments?: readonly Payment[],
  reference = new Date()
): Promise<number> {
  const records = await resolvePayments(allPayments);
  const referenceMonth = getDateKey(reference).slice(0, 7);
  return sumPayments(
    records.filter(
      (payment) => isCollected(payment) && monthKey(payment.date) === referenceMonth
    )
  );
}

export async function getRevenueThisYear(
  allPayments?: readonly Payment[],
  reference = new Date()
): Promise<number> {
  const records = await resolvePayments(allPayments);
  const referenceYear = getDateKey(reference).slice(0, 4);
  return sumPayments(
    records.filter(
      (payment) =>
        isCollected(payment) && payment.date.slice(0, 4) === referenceYear
    )
  );
}

export async function getRevenueByStudent(
  studentId: string,
  allPayments?: readonly Payment[]
): Promise<number> {
  const records = await resolvePayments(allPayments);
  return sumPayments(
    records.filter((payment) => payment.studentId === studentId && isCollected(payment))
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
  allPayments?: readonly Payment[],
  allSessions?: readonly Session[],
  allAttendance?: readonly Attendance[]
): Promise<number> {
  const [studentRecords, paymentRecords, sessionRecords, attendanceRecords] = await Promise.all([
    allStudents ? Promise.resolve([...allStudents]) : findStudents(),
    resolvePayments(allPayments),
    allSessions ? Promise.resolve([...allSessions]) : findSessions(),
    allAttendance ? Promise.resolve([...allAttendance]) : findAttendance(),
  ]);

  const balances = await Promise.all(
    studentRecords.map((student) =>
      getOutstandingBalance(
        student.id,
        paymentRecords,
        studentRecords,
        sessionRecords,
        attendanceRecords
      )
    )
  );

  return balances.reduce((total, value) => total + value, 0);
}

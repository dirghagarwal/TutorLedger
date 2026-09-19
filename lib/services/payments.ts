import { findAttendance } from "@/lib/repositories/attendance";
import { findPayments } from "@/lib/repositories/payments";
import { findSessions } from "@/lib/repositories/sessions";
import { findStudentById, findStudents } from "@/lib/repositories/students";
import { AttendanceStatus, type Attendance } from "@/types/attendance";
import { BillingPeriod, PaymentStatus, type Payment } from "@/types/payment";
import { FeeType, type Student } from "@/types/students";
import { getTodayDateKey } from "@/lib/utils/date";
import type { Session } from "@/types/session";

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

function monthIndex(monthKey: string): number {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return Number.NaN;
  }
  return year * 12 + month - 1;
}

function monthKeyFromDate(date: string): string | null {
  const monthKey = date.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : null;
}

function getMonthlyAccrual(
  studentId: string,
  fee: number,
  records: readonly Payment[],
  sessions: readonly Session[],
  currentMonthKey: string,
): number {
  const observedMonths = [
    ...records
      .filter((payment) => payment.studentId === studentId && payment.billingPeriod === BillingPeriod.MONTHLY)
      .map((payment) => monthKeyFromDate(payment.date)),
    ...sessions
      .filter((session) => session.studentId === studentId)
      .map((session) => monthKeyFromDate(session.date)),
  ].filter((month): month is string => month !== null && month <= currentMonthKey);

  const startMonthKey = observedMonths.length > 0
    ? observedMonths.reduce((earliest, current) => (current < earliest ? current : earliest))
    : currentMonthKey;

  const startIndex = monthIndex(startMonthKey);
  const currentIndex = monthIndex(currentMonthKey);
  if (Number.isNaN(startIndex) || Number.isNaN(currentIndex)) return fee;

  const monthsElapsed = Math.max(1, currentIndex - startIndex + 1);
  return monthsElapsed * fee;
}

interface BalanceSummary {
  outstanding: number;
  credit: number;
}

function calculateBalance(
  student: Student,
  records: readonly Payment[],
  sessions: readonly Session[],
  attendanceRecords: readonly Attendance[],
): BalanceSummary {
  if (student.feeType === FeeType.CLASSWISE) {
    const studentSessionIds = new Set(
      sessions.filter((session) => session.studentId === student.id).map((session) => session.id),
    );

    const attendedCount = attendanceRecords.filter(
      (attendance) =>
        studentSessionIds.has(attendance.sessionId) &&
        attendance.status === AttendanceStatus.PRESENT,
    ).length;

    const accruedFees = attendedCount * student.fee;
    const collectedFees = sumPayments(
      records.filter(
        (payment) =>
          payment.studentId === student.id &&
          payment.billingPeriod === BillingPeriod.CLASSWISE &&
          isCollected(payment),
      ),
    );

    return {
      outstanding: Math.max(0, accruedFees - collectedFees),
      credit: Math.max(0, collectedFees - accruedFees),
    };
  }

  const currentMonthKey = getTodayDateKey().slice(0, 7);
  const accruedFees = getMonthlyAccrual(
    student.id,
    student.fee,
    records,
    sessions,
    currentMonthKey,
  );
  const collectedFees = sumPayments(
    records.filter(
      (payment) =>
        payment.studentId === student.id &&
        payment.billingPeriod === BillingPeriod.MONTHLY &&
        isCollected(payment) &&
        payment.date.slice(0, 7) <= currentMonthKey,
    ),
  );

  return {
    outstanding: Math.max(0, accruedFees - collectedFees),
    credit: Math.max(0, collectedFees - accruedFees),
  };
}

export async function getOutstandingBalance(
  studentId: string,
  allPayments?: readonly Payment[],
  allStudents?: readonly Student[],
  allSessions?: readonly Session[],
  allAttendance?: readonly Attendance[],
): Promise<number> {
  const records = await resolvePayments(allPayments);
  const student = allStudents
    ? allStudents.find((s) => s.id === studentId)
    : await findStudentById(studentId);

  if (!student) return 0;

  const sessions = allSessions ? [...allSessions] : await findSessions();
  const attendanceRecords = allAttendance ? [...allAttendance] : await findAttendance();
  return calculateBalance(student, records, sessions, attendanceRecords).outstanding;
}

export async function getAdvanceCreditBalance(
  studentId: string,
  allPayments?: readonly Payment[],
  allStudents?: readonly Student[],
  allSessions?: readonly Session[],
  allAttendance?: readonly Attendance[],
): Promise<number> {
  const records = await resolvePayments(allPayments);
  const student = allStudents
    ? allStudents.find((s) => s.id === studentId)
    : await findStudentById(studentId);

  if (!student) return 0;

  const sessions = allSessions ? [...allSessions] : await findSessions();
  const attendanceRecords = allAttendance ? [...allAttendance] : await findAttendance();
  return calculateBalance(student, records, sessions, attendanceRecords).credit;
}

function getRevenueByStudentSync(studentId: string, records: readonly Payment[]): number {
  return sumPayments(
    records.filter((p) => p.studentId === studentId && isCollected(p))
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
  return getRevenueByStudentSync(studentId, records);
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
      getOutstandingBalance(student.id, paymentRecords, studentRecords, sessionRecords, attendanceRecords)
    )
  );

  return balances.reduce((total, val) => total + val, 0);
}

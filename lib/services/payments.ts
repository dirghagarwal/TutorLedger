import { findAttendance } from "@/lib/repositories/attendance";
import { findPayments } from "@/lib/repositories/payments";
import { findSessions } from "@/lib/repositories/sessions";
import { findStudentById, findStudents } from "@/lib/repositories/students";
import { AttendanceStatus, type Attendance } from "@/types/attendance";
import { PaymentStatus, type Payment } from "@/types/payment";
import { FeeType, type Student } from "@/types/students";
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

export async function getOutstandingBalance(
  studentId: string,
  allPayments?: readonly Payment[],
  allStudents?: readonly Student[],
  allSessions?: readonly Session[],
  allAttendance?: readonly Attendance[]
): Promise<number> {
  const records = await resolvePayments(allPayments);
  const student = allStudents
    ? allStudents.find((s) => s.id === studentId)
    : await findStudentById(studentId);

  const pendingPaymentsAmount = sumPayments(
    records.filter(
      (payment) =>
        payment.studentId === studentId && payment.status === PaymentStatus.PENDING
    )
  );

  if (!student) return pendingPaymentsAmount;

  if (student.feeType === FeeType.CLASSWISE) {
    const attendanceRecords = allAttendance ? [...allAttendance] : await findAttendance();
    const sessions = allSessions ? [...allSessions] : await findSessions();

    const studentSessionIds = new Set(
      sessions.filter((s) => s.studentId === studentId).map((s) => s.id)
    );

    const attendedCount = attendanceRecords.filter(
      (a) => studentSessionIds.has(a.sessionId) && a.status === AttendanceStatus.PRESENT
    ).length;

    const accruedFees = attendedCount * student.fee;
    const paidFees = getRevenueByStudentSync(studentId, records);
    const balanceFromAccrual = Math.max(0, accruedFees - paidFees);

    return Math.max(balanceFromAccrual, pendingPaymentsAmount);
  }

  return pendingPaymentsAmount > 0 ? pendingPaymentsAmount : Math.max(0, student.fee - getRevenueByStudentSync(studentId, records));
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

import { findAttendance } from "@/lib/repositories/attendance";
import { findPayments } from "@/lib/repositories/payments";
import { findSessions } from "@/lib/repositories/sessions";
import { findStudentById, findStudents } from "@/lib/repositories/students";
import { AttendanceStatus, type Attendance } from "@/types/attendance";
import { PaymentStatus, type Payment } from "@/types/payment";
import { FeeType, type Student } from "@/types/students";
import { getDateKey, getTodayDateKey } from "@/lib/utils/date";
import { calculateLedgerBalance, calculateMonthlyAccruedFee, getMonthKey } from "@/lib/services/billing";
import type { Session } from "@/types/session";

function isCollected(payment: Payment): boolean {
  return (
    payment.status === PaymentStatus.PAID ||
    payment.status === PaymentStatus.PARTIAL
  );
}

function isSameMonth(date: string, reference: Date): boolean {
  return date.slice(0, 7) === getDateKey(reference).slice(0, 7);
}

function isSameYear(date: string, reference: Date): boolean {
  return date.slice(0, 4) === getDateKey(reference).slice(0, 4);
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
  const { balance } = await getLedgerSnapshot(
    studentId,
    allPayments,
    allStudents,
    allSessions,
    allAttendance,
  );
  return balance.outstanding;
}

export async function getCreditBalance(
  studentId: string,
  allPayments?: readonly Payment[],
  allStudents?: readonly Student[],
  allSessions?: readonly Session[],
  allAttendance?: readonly Attendance[]
): Promise<number> {
  const { balance } = await getLedgerSnapshot(
    studentId,
    allPayments,
    allStudents,
    allSessions,
    allAttendance,
  );
  return balance.credit;
}

async function getLedgerSnapshot(
  studentId: string,
  allPayments?: readonly Payment[],
  allStudents?: readonly Student[],
  allSessions?: readonly Session[],
  allAttendance?: readonly Attendance[]
): Promise<{ balance: ReturnType<typeof calculateLedgerBalance> }> {
  const records = await resolvePayments(allPayments);
  const student = allStudents
    ? allStudents.find((s) => s.id === studentId)
    : await findStudentById(studentId);

  if (!student) return { balance: calculateLedgerBalance(0, 0) };

  const sessions = allSessions ? [...allSessions] : await findSessions();
  const attendanceRecords =
    allAttendance ? [...allAttendance] : await findAttendance();

  const studentSessionIds = new Set(
    sessions.filter((session) => session.studentId === studentId).map((session) => session.id)
  );

  const collected = getRevenueByStudentSync(studentId, records);

  if (student.feeType === FeeType.CLASSWISE) {
    const attendedCount = attendanceRecords.filter(
      (attendance) =>
        studentSessionIds.has(attendance.sessionId) &&
        attendance.status === AttendanceStatus.PRESENT
    ).length;
    const accruedFees = attendedCount * student.fee;
    return { balance: calculateLedgerBalance(accruedFees, collected) };
  }

  const currentMonthKey = getTodayDateKey().slice(0, 7);
  const historicalDates = [
    ...sessions
      .filter((session) => session.studentId === studentId)
      .map((session) => session.date),
    ...records
      .filter((payment) => payment.studentId === studentId)
      .map((payment) => payment.date),
  ];
  if (!student.active && historicalDates.length === 0) {
    return { balance: calculateLedgerBalance(0, collected) };
  }

  const latestActivityMonth = historicalDates
    .map(getMonthKey)
    .filter((month) => month <= currentMonthKey)
    .sort()
    .at(-1);

  const billingCurrentMonthKey =
    !student.active && latestActivityMonth ? latestActivityMonth : currentMonthKey;

  const accruedFees = calculateMonthlyAccruedFee(
    student.fee,
    billingCurrentMonthKey,
    historicalDates,
    student.billingStartMonth,
  );

  return { balance: calculateLedgerBalance(accruedFees, collected) };
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

// "Pending fees" is derived from the canonical accrued-vs-collected ledger.
// A Payment with status=PENDING is a transaction state, not an additional fee balance.
export async function getPendingStudents(
  allStudents?: readonly Student[],
  allPayments?: readonly Payment[],
  allSessions?: readonly Session[],
  allAttendance?: readonly Attendance[]
): Promise<Student[]> {
  const [studentRecords, paymentRecords, sessionRecords, attendanceRecords] = await Promise.all([
    allStudents ? Promise.resolve([...allStudents]) : findStudents(),
    resolvePayments(allPayments),
    allSessions ? Promise.resolve([...allSessions]) : findSessions(),
    allAttendance ? Promise.resolve([...allAttendance]) : findAttendance(),
  ]);

  const balances = await Promise.all(
    studentRecords.map(async (student) =>
      getOutstandingBalance(
        student.id,
        paymentRecords,
        studentRecords,
        sessionRecords,
        attendanceRecords
      )
    )
  );

  return studentRecords.filter((student, index) => (balances[index] ?? 0) > 0);
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

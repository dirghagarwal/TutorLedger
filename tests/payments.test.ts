import { test } from "node:test";
import assert from "node:assert/strict";

import { calculateBalance } from "@/lib/services/payments";
import { PaymentStatus, BillingPeriod, PaymentMethod, type Payment } from "@/types/payment";
import { AttendanceStatus, type Attendance } from "@/types/attendance";
import { FeeType, type Student } from "@/types/students";
import type { Session } from "@/types/session";

const student = (feeType: FeeType, fee: number): Student => ({
  id: "student-1",
  name: "Test Student",
  subject: "Maths",
  feeType,
  fee,
  active: true,
  color: "#fff",
});

const session = (date: string): Session => ({
  id: `session-${date}`,
  studentId: "student-1",
  scheduleId: "schedule-1",
  date,
  startTime: "16:30",
  endTime: "17:30",
  status: "COMPLETED" as Session["status"],
});

const attendance = (sessionId: string): Attendance => ({
  id: `attendance-${sessionId}`,
  sessionId,
  date: sessionId.slice(-10),
  startTime: "16:30",
  endTime: "17:30",
  status: AttendanceStatus.PRESENT,
  notes: "",
});

const payment = (
  amount: number,
  date: string,
  billingPeriod: BillingPeriod,
  status: PaymentStatus = PaymentStatus.PAID,
): Payment => ({
  id: `payment-${amount}-${date}-${billingPeriod}-${status}`,
  studentId: "student-1",
  sessionId: null,
  amount,
  date,
  method: PaymentMethod.UPI,
  status,
  billingPeriod,
  notes: "",
});

test("monthly fee accrues for every elapsed billing month", () => {
  const result = calculateBalance(
    student(FeeType.MONTHLY, 2000),
    [payment(2000, "2026-07-05", BillingPeriod.MONTHLY)],
    [session("2026-07-10")],
    [],
    "2026-09",
  );

  assert.deepEqual(result, { outstanding: 4000, credit: 0 });
});

test("classwise advance payment becomes visible credit instead of outstanding", () => {
  const result = calculateBalance(
    student(FeeType.CLASSWISE, 100),
    [payment(2500, "2026-09-05", BillingPeriod.CLASSWISE)],
    [session("2026-09-10")],
    [attendance("session-2026-09-10")],
    "2026-09",
  );

  assert.deepEqual(result, { outstanding: 0, credit: 2400 });
});

test("pending invoice does not double-count against accrued class fees", () => {
  const result = calculateBalance(
    student(FeeType.CLASSWISE, 100),
    [payment(2500, "2026-09-05", BillingPeriod.CLASSWISE, PaymentStatus.PENDING)],
    [session("2026-09-10")],
    [attendance("session-2026-09-10")],
    "2026-09",
  );

  assert.deepEqual(result, { outstanding: 100, credit: 0 });
});

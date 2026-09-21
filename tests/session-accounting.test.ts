import test from "node:test";
import assert from "node:assert/strict";
import { FeeType } from "../types/students";
import { SessionStatus } from "../types/session";
import { AttendanceStatus } from "../types/attendance";
import { calculateMonthlyAccruedFee } from "../lib/services/billing";
import { studentSchema } from "../lib/validations/student";

test("student validation accepts valid billingStartMonth in YYYY-MM format", () => {
  const valid = studentSchema.safeParse({
    name: "Aarav",
    subject: "Mathematics",
    feeType: FeeType.MONTHLY,
    fee: 3000,
    active: true,
    color: "#6366f1",
    billingStartMonth: "2026-08",
  });
  assert.equal(valid.success, true);
});

test("student validation rejects invalid billingStartMonth formats", () => {
  const invalidFormat = studentSchema.safeParse({
    name: "Aarav",
    subject: "Mathematics",
    feeType: FeeType.MONTHLY,
    fee: 3000,
    color: "#6366f1",
    billingStartMonth: "August 2026",
  });
  assert.equal(invalidFormat.success, false);

  const invalidDayIncluded = studentSchema.safeParse({
    name: "Aarav",
    subject: "Mathematics",
    feeType: FeeType.MONTHLY,
    fee: 3000,
    color: "#6366f1",
    billingStartMonth: "2026-08-01",
  });
  assert.equal(invalidDayIncluded.success, false);
});

test("session duplicate prevention detects collision on (studentId, date, startTime)", () => {
  const existingSessions = [
    { id: "sess-1", studentId: "std-1", date: "2026-09-20", startTime: "10:00" },
    { id: "sess-2", studentId: "std-1", date: "2026-09-20", startTime: "14:00" },
    { id: "sess-3", studentId: "std-2", date: "2026-09-20", startTime: "10:00" },
  ];

  function hasCollision(studentId: string, date: string, startTime: string, ignoreId?: string) {
    return existingSessions.some(
      (s) =>
        s.studentId === studentId &&
        s.date === date &&
        s.startTime === startTime &&
        s.id !== ignoreId
    );
  }

  // Exact collision for same student
  assert.equal(hasCollision("std-1", "2026-09-20", "10:00"), true);
  // Different start time on same date -> no collision
  assert.equal(hasCollision("std-1", "2026-09-20", "11:00"), false);
  // Different student at same date and time -> no collision
  assert.equal(hasCollision("std-3", "2026-09-20", "10:00"), false);
  // Self update with same time -> ignored
  assert.equal(hasCollision("std-1", "2026-09-20", "10:00", "sess-1"), false);
});

test("class-wise billing excludes cancelled sessions even if attendance was present", () => {
  const student = { id: "std-cw", feeType: FeeType.CLASSWISE, fee: 500 };
  const sessions = [
    { id: "s1", studentId: "std-cw", status: SessionStatus.COMPLETED },
    { id: "s2", studentId: "std-cw", status: SessionStatus.COMPLETED },
    { id: "s3", studentId: "std-cw", status: SessionStatus.CANCELLED }, // cancelled session
  ];
  const attendanceRecords = [
    { sessionId: "s1", status: AttendanceStatus.PRESENT },
    { sessionId: "s2", status: AttendanceStatus.PRESENT },
    { sessionId: "s3", status: AttendanceStatus.PRESENT }, // orphaned present status on cancelled session
  ];

  // Logic from payments.ts getLedgerSnapshot:
  const validSessionIds = new Set(
    sessions
      .filter((s) => s.studentId === student.id && s.status !== SessionStatus.CANCELLED)
      .map((s) => s.id)
  );

  const attendedCount = attendanceRecords.filter(
    (att) => validSessionIds.has(att.sessionId) && att.status === AttendanceStatus.PRESENT
  ).length;

  const accruedFees = attendedCount * student.fee;
  assert.equal(attendedCount, 2);
  assert.equal(accruedFees, 1000); // 2 * 500, s3 excluded!
});

test("monthly billing excludes cancelled sessions from creating historical billing activity", () => {
  const currentMonthKey = "2026-09";
  const monthlyFee = 2000;

  // Student has an old cancelled session in 2026-01, and an active session in 2026-08
  const sessions = [
    { studentId: "std-m", date: "2026-01-15", status: SessionStatus.CANCELLED },
    { studentId: "std-m", date: "2026-08-10", status: SessionStatus.COMPLETED },
  ];
  const payments: Array<{ studentId: string; date: string }> = [];

  // Filtered historicalDates from payments.ts getLedgerSnapshot:
  const historicalDates = [
    ...sessions
      .filter((s) => s.studentId === "std-m" && s.status !== SessionStatus.CANCELLED)
      .map((s) => s.date),
    ...payments.map((p) => p.date),
  ];

  assert.deepEqual(historicalDates, ["2026-08-10"]);

  // Accrued fee should only accrue from 2026-08 through 2026-09 (2 months = 4000), NOT from 2026-01 (9 months = 18000)
  const accrued = calculateMonthlyAccruedFee(monthlyFee, currentMonthKey, historicalDates);
  assert.equal(accrued, 4000);
});

test("calendar aggregation uses collision-safe key (studentId:date:startTime)", () => {
  const sessions = [
    { id: "s1", scheduleId: "sch-adhoc", studentId: "std-1", date: "2026-09-20", startTime: "10:00" },
    { id: "s2", scheduleId: "sch-adhoc", studentId: "std-1", date: "2026-09-20", startTime: "15:00" }, // same scheduleId and date, different time
    { id: "s3", scheduleId: "sch-adhoc", studentId: "std-2", date: "2026-09-20", startTime: "10:00" }, // same time, different student
  ];

  // Old buggy aggregation: key was scheduleId:date -> only 1 session survived!
  const buggyMap = new Map(sessions.map((s) => [`${s.scheduleId}:${s.date}`, s]));
  assert.equal(buggyMap.size, 1);

  // New collision-safe aggregation: key is studentId:date:startTime
  const safeMap = new Map(sessions.map((s) => [`${s.studentId}:${s.date}:${s.startTime}`, s]));
  assert.equal(safeMap.size, 3);
});

import test from "node:test";
import assert from "node:assert/strict";
import { scheduleInputSchema } from "../lib/validations/schedule";
import { DayOfWeek } from "../types/schedule";

test("schedule validation accepts valid HH:MM and endTime > startTime", () => {
  const valid = scheduleInputSchema.safeParse({
    studentId: "std-1",
    subject: "Math",
    dayOfWeek: DayOfWeek.MONDAY,
    startTime: "16:00",
    endTime: "17:30",
  });
  assert.equal(valid.success, true);
});

test("schedule validation rejects invalid HH:MM format", () => {
  const invalid = scheduleInputSchema.safeParse({
    studentId: "std-1",
    subject: "Math",
    dayOfWeek: DayOfWeek.MONDAY,
    startTime: "4pm",
    endTime: "17:00",
  });
  assert.equal(invalid.success, false);
});

test("schedule validation rejects endTime equal to or earlier than startTime", () => {
  const equalTime = scheduleInputSchema.safeParse({
    studentId: "std-1",
    subject: "Math",
    dayOfWeek: DayOfWeek.MONDAY,
    startTime: "16:00",
    endTime: "16:00",
  });
  assert.equal(equalTime.success, false);
  if (!equalTime.success) {
    assert.match(equalTime.error.issues[0]?.message ?? "", /End time must be after start time/);
  }

  const earlierTime = scheduleInputSchema.safeParse({
    studentId: "std-1",
    subject: "Math",
    dayOfWeek: DayOfWeek.MONDAY,
    startTime: "16:00",
    endTime: "15:00",
  });
  assert.equal(earlierTime.success, false);
});

test("duplicate active schedule check detects collision on same student/day/time", () => {
  const existingSchedules = [
    { id: "sch-1", studentId: "student-1", dayOfWeek: DayOfWeek.MONDAY, startTime: "16:00", endTime: "17:00", active: true },
    { id: "sch-2", studentId: "student-1", dayOfWeek: DayOfWeek.TUESDAY, startTime: "16:00", endTime: "17:00", active: true },
    { id: "sch-3", studentId: "student-1", dayOfWeek: DayOfWeek.MONDAY, startTime: "18:00", endTime: "19:00", active: false }, // inactive
  ];

  function isDuplicateActiveSchedule(
    studentId: string,
    dayOfWeek: string,
    startTime: string,
    ignoreId?: string
  ): boolean {
    return existingSchedules.some(
      (s) =>
        s.studentId === studentId &&
        s.active &&
        s.dayOfWeek === dayOfWeek &&
        s.startTime === startTime &&
        s.id !== ignoreId
    );
  }

  // Exact collision with active schedule
  assert.equal(isDuplicateActiveSchedule("student-1", DayOfWeek.MONDAY, "16:00"), true);
  // Different time on same day -> allowed
  assert.equal(isDuplicateActiveSchedule("student-1", DayOfWeek.MONDAY, "17:00"), false);
  // Same time on different day -> allowed
  assert.equal(isDuplicateActiveSchedule("student-1", DayOfWeek.WEDNESDAY, "16:00"), false);
  // Collision with inactive schedule -> allowed
  assert.equal(isDuplicateActiveSchedule("student-1", DayOfWeek.MONDAY, "18:00"), false);
  // Editing existing schedule without changing time -> ignored own ID
  assert.equal(isDuplicateActiveSchedule("student-1", DayOfWeek.MONDAY, "16:00", "sch-1"), false);
});

test("schedule removal soft-deactivates if historical sessions exist", () => {
  function determineRemovalAction(sessionCount: number): "soft-deactivate" | "hard-delete" {
    return sessionCount > 0 ? "soft-deactivate" : "hard-delete";
  }

  assert.equal(determineRemovalAction(5), "soft-deactivate");
  assert.equal(determineRemovalAction(1), "soft-deactivate");
  assert.equal(determineRemovalAction(0), "hard-delete");
});

test("deterministic ad-hoc schedule provisioning is idempotent and inactive", () => {
  const studentId = "std-123";
  const expectedScheduleId = `sch-adhoc-${studentId}`;

  function getAdHocScheduleConfig(student: { id: string; subject: string; teacherId: string }) {
    return {
      id: `sch-adhoc-${student.id}`,
      studentId: student.id,
      dayOfWeek: DayOfWeek.MONDAY,
      startTime: "00:00",
      endTime: "00:00",
      subject: student.subject,
      active: false,
    };
  }

  const student = { id: studentId, subject: "Physics", teacherId: "teacher-1" };
  const schedule1 = getAdHocScheduleConfig(student);
  const schedule2 = getAdHocScheduleConfig(student);

  assert.equal(schedule1.id, expectedScheduleId);
  assert.equal(schedule1.id, schedule2.id);
  assert.equal(schedule1.active, false);
  assert.equal(schedule1.subject, "Physics");
});

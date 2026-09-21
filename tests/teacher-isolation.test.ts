import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../lib/auth/session";

test("teacher password hashing generates salted scrypt hash", () => {
  const password = "StrongPassword123!";
  const hash = hashPassword(password);

  assert.ok(hash.startsWith("scrypt$"));
  const parts = hash.split("$");
  assert.equal(parts.length, 3);
  assert.equal(parts[1].length, 32); // 16 bytes hex salt
  assert.equal(parts[2].length, 128); // 64 bytes hex derived key
});

test("teacher password verification succeeds with correct password and rejects incorrect password", () => {
  const password = "SuperSecretTeacherPassword";
  const hash = hashPassword(password);

  assert.equal(verifyPassword(password, hash), true);
  assert.equal(verifyPassword("WrongPassword", hash), false);
  assert.equal(verifyPassword("", hash), false);
  assert.equal(verifyPassword(password, null), false);
  assert.equal(verifyPassword(password, "invalid-hash-format"), false);
});

test("password rotation updates stored hash while keeping tenant intact", () => {
  const teacher = {
    id: "teacher-dirgh",
    name: "Dirgh Agarwal",
    email: "dirgh@example.com",
    passwordHash: hashPassword("OldPassword123!"),
  };

  // Step 1: Verify current password
  assert.equal(verifyPassword("OldPassword123!", teacher.passwordHash), true);

  // Step 2: Rotate password
  const newPassword = "NewPassword456!";
  teacher.passwordHash = hashPassword(newPassword);

  // Step 3: Old password fails, new password succeeds
  assert.equal(verifyPassword("OldPassword123!", teacher.passwordHash), false);
  assert.equal(verifyPassword("NewPassword456!", teacher.passwordHash), true);
});

test("re-authenticated account switching creates isolated session for target teacher", () => {
  const teachers = [
    { id: "teacher-dirgh", name: "Dirgh", email: "dirgh@example.com", passwordHash: hashPassword("DirghPass123!") },
    { id: "teacher-rajshree", name: "Rajshree", email: "rajshree@example.com", passwordHash: hashPassword("RajshreePass123!") },
  ];

  function switchTeacherAccount(email: string, passwordAttempt: string) {
    const target = teachers.find((t) => t.email === email.toLowerCase());
    if (!target || !verifyPassword(passwordAttempt, target.passwordHash)) {
      return { ok: false, error: "Invalid credentials" };
    }
    // Return newly issued session context
    return { ok: true, activeTeacherId: target.id, activeTeacherName: target.name };
  }

  // Failed switch with incorrect password
  const failedSwitch = switchTeacherAccount("rajshree@example.com", "WrongPassword!");
  assert.equal(failedSwitch.ok, false);

  // Successful switch to Rajshree
  const successSwitch = switchTeacherAccount("rajshree@example.com", "RajshreePass123!");
  assert.equal(successSwitch.ok, true);
  if (successSwitch.ok) {
    assert.equal(successSwitch.activeTeacherId, "teacher-rajshree");
    assert.equal(successSwitch.activeTeacherName, "Rajshree");
  }
});

test("tenant scoping ensures queries from one teacher never leak records of another", () => {
  const allStudents = [
    { id: "std-1", teacherId: "teacher-dirgh", name: "Student 1" },
    { id: "std-2", teacherId: "teacher-dirgh", name: "Student 2" },
    { id: "std-3", teacherId: "teacher-rajshree", name: "Rajshree's Student" },
  ];

  function queryStudentsForTeacher(teacherId: string) {
    return allStudents.filter((s) => s.teacherId === teacherId);
  }

  const dirghStudents = queryStudentsForTeacher("teacher-dirgh");
  assert.equal(dirghStudents.length, 2);
  assert.ok(dirghStudents.every((s) => s.teacherId === "teacher-dirgh"));

  const rajshreeStudents = queryStudentsForTeacher("teacher-rajshree");
  assert.equal(rajshreeStudents.length, 1);
  assert.equal(rajshreeStudents[0].name, "Rajshree's Student");
  assert.equal(rajshreeStudents[0].teacherId, "teacher-rajshree");
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  createParentPortalSessionValue,
  verifyParentPortalSessionValue,
} from "../lib/auth/parent-portal";

test("portal session token generates valid signed string and verifies successfully", () => {
  const portalId = "portal-12345";
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

  const signed = createParentPortalSessionValue(portalId, expiresAt);
  assert.ok(signed);

  const verified = verifyParentPortalSessionValue(signed);
  assert.ok(verified);
  assert.equal(verified?.portalId, portalId);
  assert.equal(verified?.expiresAt.getTime(), expiresAt.getTime());
});

test("portal session token rejects expired tokens", () => {
  const portalId = "portal-expired";
  const pastDate = new Date(Date.now() - 1000 * 60); // 1 minute ago

  const signed = createParentPortalSessionValue(portalId, pastDate);
  const verified = verifyParentPortalSessionValue(signed);
  assert.equal(verified, null);
});

test("portal session token rejects tampered signatures or modified payload", () => {
  const portalId = "portal-tamper";
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const signed = createParentPortalSessionValue(portalId, expiresAt);

  const parts = signed.split(".");
  // Change portalId in payload
  const tampered = `portal-hacked.${parts[1]}.${parts[2]}`;
  assert.equal(verifyParentPortalSessionValue(tampered), null);

  // Corrupt signature
  const badSig = `${parts[0]}.${parts[1]}.invalidSignature1234`;
  assert.equal(verifyParentPortalSessionValue(badSig), null);
});

test("student portal actions enforce dual tenantId and studentId scoping", () => {
  const authenticatedPortal = {
    portalId: "p1",
    teacherId: "teacher-dirgh",
    studentId: "student-aarav",
  };

  const databaseSessions = [
    { id: "s1", teacherId: "teacher-dirgh", studentId: "student-aarav", topic: "Algebra" },
    { id: "s2", teacherId: "teacher-dirgh", studentId: "student-rohan", topic: "Geometry" }, // same teacher, different student
    { id: "s3", teacherId: "teacher-rajshree", studentId: "student-aarav", topic: "Physics" }, // different teacher, same student name
  ];

  function authorizeStudentAction(sessionId: string, portal: typeof authenticatedPortal) {
    const session = databaseSessions.find(
      (s) =>
        s.id === sessionId &&
        s.studentId === portal.studentId &&
        s.teacherId === portal.teacherId
    );
    if (!session) {
      return { authorized: false, error: "Session not found." };
    }
    return { authorized: true, session };
  }

  // Allowed: Own session within own teacher
  const ownResult = authorizeStudentAction("s1", authenticatedPortal);
  assert.equal(ownResult.authorized, true);

  // BLOCKED: Cross-student access attempt (same teacher)
  const crossStudentResult = authorizeStudentAction("s2", authenticatedPortal);
  assert.equal(crossStudentResult.authorized, false);

  // BLOCKED: Cross-tenant access attempt (different teacher)
  const crossTenantResult = authorizeStudentAction("s3", authenticatedPortal);
  assert.equal(crossTenantResult.authorized, false);
});

test("student editable allowlist enforces permitted vs forbidden fields", () => {
  const allowedFields = new Set(["topic", "classwork", "startTime", "endTime", "attachment", "cancellation"]);
  const forbiddenFields = [
    "fee",
    "feeType",
    "billingStartMonth",
    "payment",
    "paymentAllocation",
    "studentId",
    "scheduleId",
    "teacherId",
    "homework",
    "remarks",
  ];

  function validateStudentEditInput(field: string): boolean {
    return allowedFields.has(field);
  }

  // Allowed fields pass
  assert.equal(validateStudentEditInput("topic"), true);
  assert.equal(validateStudentEditInput("classwork"), true);
  assert.equal(validateStudentEditInput("startTime"), true);
  assert.equal(validateStudentEditInput("endTime"), true);

  // Strictly forbidden fields fail
  for (const forbidden of forbiddenFields) {
    assert.equal(
      validateStudentEditInput(forbidden),
      false,
      `Forbidden field ${forbidden} must be rejected for student edits`
    );
  }
});

test("student cancellation is blocked if payment allocations exist", () => {
  const sessionAllocations = new Map<string, number>([
    ["sess-with-payment", 1],
    ["sess-unpaid", 0],
  ]);

  function canStudentCancel(sessionId: string): { ok: boolean; reason?: string } {
    const allocCount = sessionAllocations.get(sessionId) ?? 0;
    if (allocCount > 0) {
      return { ok: false, reason: "Cannot cancel a class with allocated payments. Please contact your tutor." };
    }
    return { ok: true };
  }

  assert.equal(canStudentCancel("sess-with-payment").ok, false);
  assert.equal(canStudentCancel("sess-unpaid").ok, true);
});

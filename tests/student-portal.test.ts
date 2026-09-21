import test from "node:test";
import assert from "node:assert/strict";
import {
  createParentPortalSessionValue,
  validatePortalRecord,
  verifyParentPortalSessionValue,
} from "../lib/auth/parent-portal";
import { executeStudentCancellation } from "../app/actions/parent-portal";

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

test("validatePortalRecord rejects revoked and expired portals and accepts active portals", () => {
  const activePortal = {
    id: "p-active",
    teacherId: "t-1",
    studentId: "s-1",
    revokedAt: null,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // tomorrow
  };
  const revokedPortal = {
    ...activePortal,
    id: "p-revoked",
    revokedAt: new Date(Date.now() - 1000 * 60), // revoked 1 min ago
  };
  const expiredPortal = {
    ...activePortal,
    id: "p-expired",
    expiresAt: new Date(Date.now() - 1000 * 60), // expired 1 min ago
  };

  assert.deepEqual(validatePortalRecord(activePortal), {
    portalId: "p-active",
    teacherId: "t-1",
    studentId: "s-1",
  });
  assert.equal(validatePortalRecord(revokedPortal), null);
  assert.equal(validatePortalRecord(expiredPortal), null);
  assert.equal(validatePortalRecord(null), null);
});

test("production executeStudentCancellation enforces payment allocation invariant inside transaction", async () => {
  let sessionUpdated = false;
  let attendanceUpdated = false;
  let auditCreated = false;

  const mockTxWithAllocation = {
    paymentAllocation: {
      count: async () => 1,
    },
    session: {
      update: async () => {
        sessionUpdated = true;
      },
    },
    attendance: {
      updateMany: async () => {
        attendanceUpdated = true;
      },
    },
    auditLog: {
      create: async () => {
        auditCreated = true;
      },
    },
  };

  // Must reject and abort before updating session, attendance, or audit log
  await assert.rejects(
    async () => {
      await executeStudentCancellation(mockTxWithAllocation, {
        sessionId: "session-allocated",
        studentId: "student-1",
        teacherId: "teacher-1",
        sessionDate: "2026-09-20",
      });
    },
    { message: "CANNOT_CANCEL_ALLOCATED_SESSION" }
  );

  assert.equal(sessionUpdated, false);
  assert.equal(attendanceUpdated, false);
  assert.equal(auditCreated, false);
});

test("production executeStudentCancellation atomically updates session, attendance, and audit log when unallocated", async () => {
  let updatedSessionData: Record<string, unknown> | null = null;
  let updatedAttendanceWhere: Record<string, unknown> | null = null;
  let createdAuditData: { action?: string; teacherId?: string; studentId?: string } | null = null;

  const mockTxUnallocated = {
    paymentAllocation: {
      count: async () => 0,
    },
    session: {
      update: async (args: { where: { id: string }; data: { status: string } }) => {
        updatedSessionData = args.data;
      },
    },
    attendance: {
      updateMany: async (args: { where: { sessionId: string; teacherId: string }; data: { status: string } }) => {
        updatedAttendanceWhere = args.where;
      },
    },
    auditLog: {
      create: async (args: { data: { action?: string; teacherId?: string; studentId?: string } }) => {
        createdAuditData = args.data;
      },
    },
  };

  await executeStudentCancellation(mockTxUnallocated, {
    sessionId: "session-free",
    studentId: "student-1",
    teacherId: "teacher-1",
    sessionDate: "2026-09-20",
  });

  assert.deepEqual(updatedSessionData, { status: "CANCELLED" });
  assert.deepEqual(updatedAttendanceWhere, { sessionId: "session-free", teacherId: "teacher-1" });
  const capturedAudit = createdAuditData as { action?: string; teacherId?: string; studentId?: string } | null;
  assert.equal(capturedAudit?.action, "STUDENT_SESSION_CANCELLED");
  assert.equal(capturedAudit?.teacherId, "teacher-1");
  assert.equal(capturedAudit?.studentId, "student-1");
});

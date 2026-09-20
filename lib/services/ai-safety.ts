import { createHmac, timingSafeEqual } from "node:crypto";
import { getRequestTeacherId } from "@/lib/auth/session";
import { rawPrisma } from "@/lib/db/raw";

/**
 * Central AI Safety Policy & Audit Logging for TutorLedger V2
 * Enforces strict boundaries between session deletion, student deletion, and financial actions.
 */

export interface AuditEntry {
  timestamp: string;
  teacherId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  studentId?: string;
  sessionId?: string;
  resolvedDate?: string;
  userPrompt: string;
  result: string;
  metadata?: Record<string, unknown>;
}


const CONFIRMATION_TTL_MS = 5 * 60 * 1000;

function confirmationSecret(): string {
  return process.env.TUTORLEDGER_CONFIRM_SECRET ?? process.env.DATABASE_URL ?? "development-only-confirmation-secret";
}

function sign(value: string): string {
  return createHmac("sha256", confirmationSecret()).update(value).digest("base64url");
}

export function isDestructiveAction(actionType: string): boolean {
  return actionType === "DELETE_SESSION" || actionType === "DELETE_STUDENT_REQUEST";
}

export function requiresConfirmation(actionType: string): boolean {
  return (
    actionType === "DELETE_SESSION" ||
    actionType === "DELETE_STUDENT_REQUEST" ||
    actionType === "RECORD_PAYMENT"
  );
}

export function requiresStrongConfirmation(actionType: string): boolean {
  return actionType === "DELETE_STUDENT_REQUEST";
}

export function generateConfirmationToken(payload: {
  studentId?: string;
  sessionId?: string;
  action: string;
}): string {
  const expiresAt = Date.now() + CONFIRMATION_TTL_MS;
  const nonce = crypto.randomUUID();
  const data = JSON.stringify({ action: payload.action, studentId: payload.studentId ?? "", sessionId: payload.sessionId ?? "", nonce, expiresAt });
  return Buffer.from(data).toString("base64url") + "." + sign(data);
}

export function verifyConfirmationToken(
  token: string,
  expectedAction: string,
  expectedId?: string
): boolean {
  if (!token) return false;
  try {
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) return false;
    const data = Buffer.from(encoded, "base64url").toString("utf-8");
    const expectedSignature = sign(data);
    const a = Buffer.from(signature);
    const b = Buffer.from(expectedSignature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    const parsed = JSON.parse(data) as { action?: string; studentId?: string; sessionId?: string; expiresAt?: number };
    if (parsed.action !== expectedAction || !parsed.expiresAt || parsed.expiresAt < Date.now()) return false;
    if (expectedId && parsed.studentId !== expectedId && parsed.sessionId !== expectedId) return false;
    return true;
  } catch {
    return false;
  }
}

export async function logAiAuditTrail(
  entry: Omit<AuditEntry, "timestamp" | "teacherId">
): Promise<void> {
  const teacherId = await getRequestTeacherId();
  if (!teacherId) throw new Error("UNAUTHENTICATED");

  const record: AuditEntry = {
    timestamp: new Date().toISOString(),
    teacherId,
    ...entry,
    userPrompt: entry.userPrompt.slice(0, 4000),
    result: entry.result.slice(0, 2000),
  };

  await rawPrisma.auditLog.create({
    data: {
      id: crypto.randomUUID(),
      teacherId,
      action: record.action,
      entityType: record.entityType,
      entityId: record.entityId,
      studentId: record.studentId,
      sessionId: record.sessionId,
      resolvedDate: record.resolvedDate,
      userPrompt: record.userPrompt,
      result: record.result,
      metadata: record.metadata as never,
      createdAt: new Date(record.timestamp),
    },
  });

}

export async function getAuditLogs(limit = 100): Promise<AuditEntry[]> {
  const teacherId = await getRequestTeacherId();
  if (!teacherId) throw new Error("UNAUTHENTICATED");

  const rows = await rawPrisma.auditLog.findMany({
    where: { teacherId },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(limit, 500)),
  });

  return rows.map((row) => ({
    timestamp: row.createdAt.toISOString(),
    teacherId: row.teacherId,
    action: row.action,
    entityType: row.entityType ?? undefined,
    entityId: row.entityId ?? undefined,
    studentId: row.studentId ?? undefined,
    sessionId: row.sessionId ?? undefined,
    resolvedDate: row.resolvedDate ?? undefined,
    userPrompt: row.userPrompt,
    result: row.result,
    metadata: row.metadata as Record<string, unknown> | undefined,
  }));
}

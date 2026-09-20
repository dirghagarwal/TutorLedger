import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Central AI Safety Policy & Audit Logging for TutorLedger V2
 * Enforces strict boundaries between session deletion, student deletion, and financial actions.
 */

export interface AuditEntry {
  timestamp: string;
  action: string;
  studentId?: string;
  sessionId?: string;
  resolvedDate?: string;
  userPrompt: string;
  result: string;
}

const auditLogs: AuditEntry[] = [];
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

export function logAiAuditTrail(entry: Omit<AuditEntry, "timestamp">): void {
  const record: AuditEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };
  auditLogs.push(record);
  console.log(
    `[AI AUDIT SAFETY LOG] ${record.timestamp} | Action: ${record.action} | Student: ${record.studentId ?? "N/A"} | Session: ${record.sessionId ?? "N/A"} | Date: ${record.resolvedDate ?? "N/A"} | Result: ${record.result}`
  );
}

export function getAuditLogs(): readonly AuditEntry[] {
  return auditLogs;
}

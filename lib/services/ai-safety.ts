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
  const nonce = crypto.randomUUID().slice(0, 8);
  const data = `${payload.action}:${payload.studentId ?? ""}:${payload.sessionId ?? ""}:${nonce}`;
  return Buffer.from(data).toString("base64");
}

export function verifyConfirmationToken(
  token: string,
  expectedAction: string,
  expectedId?: string
): boolean {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [action, studentId, sessionId] = decoded.split(":");
    if (action !== expectedAction) return false;
    if (expectedId && studentId !== expectedId && sessionId !== expectedId) return false;
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

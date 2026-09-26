import { createHmac, timingSafeEqual } from "node:crypto";
const PARENT_COOKIE_NAME = "tutorledger_parent_access";
const STUDENT_COOKIE_NAME = "tutorledger_student_access";
const PARENT_SECRET = process.env.TUTORLEDGER_PARENT_SECRET ?? process.env.TUTORLEDGER_CONFIRM_SECRET ?? process.env.AUTH_SECRET ?? process.env.DATABASE_URL ?? "development-only-parent-access-secret";
function sign(value: string) { return createHmac("sha256", PARENT_SECRET).update(value).digest("base64url"); }
export function getParentPortalCookieName() { return PARENT_COOKIE_NAME; }
export function getStudentPortalCookieName() { return STUDENT_COOKIE_NAME; }
export function createParentPortalSessionValue(portalId: string, expiresAt: Date) { const payload = `${portalId}.${expiresAt.getTime()}.parent`; return `${payload}.${sign(payload)}`; }
export function createStudentPortalSessionValue(portalId: string, expiresAt: Date) { const payload = `${portalId}.${expiresAt.getTime()}.student`; return `${payload}.${sign(payload)}`; }
export function verifyPortalSessionValue(value: string | undefined) {
  if (!value) return null;
  const parts = value.split("."); let portalId: string | undefined; let expiresRaw: string | undefined; let role: "parent" | "student" | undefined; let signature: string | undefined;
  if (parts.length === 3) { [portalId, expiresRaw, signature] = parts; role = "parent"; } else if (parts.length === 4) { [portalId, expiresRaw, role, signature] = parts as [string, string, "parent" | "student", string]; } else return null;
  if (!portalId || !expiresRaw || !role || !signature) return null;
  const payload = parts.length === 3 ? `${portalId}.${expiresRaw}` : `${portalId}.${expiresRaw}.${role}`;
  const expected = sign(payload); const provided = Buffer.from(signature); const actual = Buffer.from(expected);
  if (provided.length !== actual.length || !timingSafeEqual(provided, actual)) return null;
  const expiresAtMs = Number(expiresRaw); if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return null;
  return { portalId, expiresAt: new Date(expiresAtMs), role };
}
export function verifyParentPortalSessionValue(value: string | undefined) { const session = verifyPortalSessionValue(value); return session?.role === "parent" ? session : null; }
export function verifyStudentPortalSessionValue(value: string | undefined) { const session = verifyPortalSessionValue(value); return session?.role === "student" ? session : null; }
export function validatePortalRecord(portal: { id: string; teacherId: string; studentId: string; revokedAt: Date | null; expiresAt: Date } | null) { if (!portal || portal.revokedAt || portal.expiresAt.getTime() <= Date.now()) return null; return { portalId: portal.id, teacherId: portal.teacherId, studentId: portal.studentId }; }
export async function requireStudentPortalAuth() {
  const { cookies } = await import("next/headers"); const { rawPrisma } = await import("@/lib/db/raw"); const jar = await cookies(); const studentSession = verifyStudentPortalSessionValue(jar.get(getStudentPortalCookieName())?.value); const parentSession = verifyParentPortalSessionValue(jar.get(getParentPortalCookieName())?.value); const portalSession = studentSession ?? parentSession;
  if (!portalSession) throw new Error("UNAUTHORIZED_PORTAL");
  const portal = await rawPrisma.parentPortal.findUnique({ where: { id: portalSession.portalId }, select: { id: true, teacherId: true, studentId: true, revokedAt: true, expiresAt: true } }); const validated = validatePortalRecord(portal); if (!validated) throw new Error("UNAUTHORIZED_PORTAL"); return { ...validated, role: portalSession.role };
}

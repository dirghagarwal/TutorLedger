import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "tutorledger_parent_access";
const PARENT_SECRET =
  process.env.TUTORLEDGER_PARENT_SECRET ??
  process.env.TUTORLEDGER_CONFIRM_SECRET ??
  process.env.AUTH_SECRET ??
  process.env.DATABASE_URL ??
  "development-only-parent-access-secret";

function sign(value: string) {
  return createHmac("sha256", PARENT_SECRET).update(value).digest("base64url");
}

export function getParentPortalCookieName() {
  return COOKIE_NAME;
}

export function createParentPortalSessionValue(portalId: string, expiresAt: Date) {
  const expires = expiresAt.getTime();
  const payload = portalId + "." + expires;
  return payload + "." + sign(payload);
}

export function verifyParentPortalSessionValue(value: string | undefined) {
  if (!value) return null;

  const parts = value.split(".");
  if (parts.length !== 3) return null;

  const portalId = parts[0];
  const expiresRaw = parts[1];
  const signature = parts[2];
  if (!portalId || !expiresRaw || !signature) return null;

  const payload = portalId + "." + expiresRaw;
  const expected = sign(payload);
  const provided = Buffer.from(signature);
  const actual = Buffer.from(expected);

  if (provided.length !== actual.length || !timingSafeEqual(provided, actual)) return null;

  const expiresAtMs = Number(expiresRaw);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return null;

  return { portalId, expiresAt: new Date(expiresAtMs) };
}

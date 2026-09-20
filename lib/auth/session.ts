import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { rawPrisma } from "@/lib/db/raw";

export const TEACHER_SESSION_COOKIE = "tutorledger_session";
const SESSION_TTL_DAYS = 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null) {
  if (!stored?.startsWith("scrypt$")) return false;
  const [, salt, expectedHex] = stored.split("$");
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function getCurrentTeacher() {
  const token = (await cookies()).get(TEACHER_SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await rawPrisma.teacherSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { teacher: true },
  });

  if (!session || session.expiresAt.getTime() <= Date.now() || !session.teacher.passwordHash) {
    if (session) {
      await rawPrisma.teacherSession.delete({ where: { id: session.id } }).catch(() => undefined);
    }
    return null;
  }

  return session.teacher;
}

export async function requireTeacher() {
  const teacher = await getCurrentTeacher();
  if (!teacher) throw new Error("UNAUTHENTICATED");
  return teacher;
}

export async function getRequestTeacherId() {
  const teacher = await getCurrentTeacher();
  return teacher?.id ?? null;
}

export async function createTeacherSession(teacherId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await rawPrisma.teacherSession.create({
    data: {
      id: crypto.randomUUID(),
      teacherId,
      tokenHash: hashToken(token),
      expiresAt,
    },
  });

  const store = await cookies();
  store.set(TEACHER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyTeacherSession() {
  const store = await cookies();
  const token = store.get(TEACHER_SESSION_COOKIE)?.value;
  if (token) {
    await rawPrisma.teacherSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(TEACHER_SESSION_COOKIE);
}

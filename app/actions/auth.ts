"use server";

import { redirect } from "next/navigation";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { rawPrisma } from "@/lib/db/raw";
import {
  createTeacherSession,
  destroyTeacherSession,
  hashPassword,
  requireTeacher,
  verifyPassword,
} from "@/lib/auth/session";


function matchesSetupKey(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

export async function loginTeacher(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) redirect("/login?error=invalid");

  const teacher = await rawPrisma.teacher.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  if (!teacher || !verifyPassword(parsed.data.password, teacher.passwordHash)) {
    redirect("/login?error=invalid");
  }

  await createTeacherSession(teacher.id);
  redirect("/");
}

export async function claimLegacyTeacher(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (token.length < 32 || password.length < 8 || password.length > 128) {
    redirect("/claim?error=invalid");
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const claimSession = await rawPrisma.teacherSession.findUnique({
    where: { tokenHash },
    include: { teacher: true },
  });

  if (
    !claimSession ||
    claimSession.expiresAt.getTime() <= Date.now() ||
    claimSession.teacher.id !== "legacy-teacher" ||
    claimSession.teacher.passwordHash
  ) {
    redirect("/claim?error=invalid");
  }

  const updated = await rawPrisma.teacher.update({
    where: { id: "legacy-teacher" },
    data: {
      name: "Dirgh Agarwal",
      email: "dirgh.agarwal@gmail.com",
      passwordHash: hashPassword(password),
    },
  });

  await rawPrisma.teacherSession.delete({ where: { id: claimSession.id } });
  await createTeacherSession(updated.id);
  redirect("/");
}

export async function setupTeacher(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const setupKey = String(formData.get("setupKey") ?? "");
  const expectedSetupKey = process.env.TUTORLEDGER_SETUP_KEY;
  const expectedInviteCode = process.env.REGISTRATION_INVITE_CODE;
  const validSetupCredential =
    (expectedSetupKey ? matchesSetupKey(setupKey, expectedSetupKey) : false) ||
    (expectedInviteCode ? matchesSetupKey(setupKey, expectedInviteCode) : false);

  if (process.env.NODE_ENV === "production" && !expectedSetupKey && !expectedInviteCode) {
    redirect("/login?error=setup-disabled");
  }

  if (
    !name ||
    !z.string().email().safeParse(email).success ||
    password.length < 8 ||
    (!validSetupCredential && process.env.NODE_ENV === "production") ||
    (!validSetupCredential && !expectedSetupKey && !expectedInviteCode)
  ) {
    redirect("/setup?error=invalid");
  }

  const teacher = await rawPrisma.teacher.findFirst({ orderBy: { createdAt: "asc" } });
  if (!teacher || teacher.passwordHash) redirect("/login?error=setup-complete");

  const updated = await rawPrisma.teacher.update({
    where: { id: teacher.id },
    data: { name, email, passwordHash: hashPassword(password) },
  });

  await createTeacherSession(updated.id);
  redirect("/");
}

export async function logoutTeacher() {
  await destroyTeacherSession();
  redirect("/login");
}


export async function createTeacherAccount(formData: FormData) {
  const current = await (await import("@/lib/auth/session")).requireTeacher();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || !z.string().email().safeParse(email).success || password.length < 8) {
    throw new Error("Enter a valid name, email and password of at least 8 characters.");
  }
  const existing = await rawPrisma.teacher.findUnique({ where: { email } });
  if (existing) throw new Error("A teacher account with that email already exists.");
  await rawPrisma.teacher.create({
    data: { id: crypto.randomUUID(), name, email, passwordHash: hashPassword(password) },
  });
  void current;
  redirect("/settings");
}


export async function registerTeacher(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const name = String(formData.get("name") ?? "").trim();

  const inviteCode = String(formData.get("inviteCode") ?? "");
  const expectedInviteCode = process.env.REGISTRATION_INVITE_CODE;

  if (!expectedInviteCode || !matchesSetupKey(inviteCode, expectedInviteCode)) {
    redirect("/register?error=invite");
  }

  if (!parsed.success || name.length < 2) {
    redirect("/register?error=invalid");
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await rawPrisma.teacher.findUnique({ where: { email } });
  if (existing) {
    redirect("/register?error=exists");
  }

  const teacher = await rawPrisma.teacher.create({
    data: {
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash: hashPassword(parsed.data.password),
    },
  });

  await createTeacherSession(teacher.id);
  redirect("/");
}

export async function updatePasswordAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const teacher = await requireTeacher();
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");

    if (!verifyPassword(currentPassword, teacher.passwordHash)) {
      return { ok: false, error: "Current password is incorrect." };
    }

    if (newPassword.length < 8 || newPassword.length > 128) {
      return { ok: false, error: "New password must be between 8 and 128 characters." };
    }

    await rawPrisma.teacher.update({
      where: { id: teacher.id },
      data: { passwordHash: hashPassword(newPassword) },
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to update password." };
  }
}

export async function provisionTeacherAccountAction(
  formData: FormData
): Promise<{ ok: true; teacherId: string } | { ok: false; error: string }> {
  try {
    await requireTeacher();
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (!name || name.length < 2) {
      return { ok: false, error: "Enter a valid name (at least 2 characters)." };
    }

    if (!z.string().email().safeParse(email).success) {
      return { ok: false, error: "Enter a valid email address." };
    }

    if (password.length < 8 || password.length > 128) {
      return { ok: false, error: "Password must be between 8 and 128 characters." };
    }

    const existing = await rawPrisma.teacher.findUnique({ where: { email } });
    if (existing) {
      return { ok: false, error: "A teacher account with that email already exists." };
    }

    const teacher = await rawPrisma.teacher.create({
      data: {
        id: crypto.randomUUID(),
        name,
        email,
        passwordHash: hashPassword(password),
      },
    });

    return { ok: true, teacherId: teacher.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to create teacher account." };
  }
}

export async function switchTeacherAccountAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireTeacher();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    const target = await rawPrisma.teacher.findUnique({ where: { email } });
    if (!target || !verifyPassword(password, target.passwordHash)) {
      return { ok: false, error: "Invalid credentials for account switch." };
    }

    await destroyTeacherSession();
    await createTeacherSession(target.id);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to switch account." };
  }
}

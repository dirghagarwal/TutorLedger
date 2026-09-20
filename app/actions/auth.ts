"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { rawPrisma } from "@/lib/db/raw";
import {
  createTeacherSession,
  destroyTeacherSession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/session";

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

export async function setupTeacher(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !z.string().email().safeParse(email).success || password.length < 8) {
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

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

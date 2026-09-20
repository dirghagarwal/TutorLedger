"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeacher, hashPassword } from "@/lib/auth/session";
import { rawPrisma } from "@/lib/db/raw";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(128),
});

export async function createTeacherAccount(formData: FormData) {
  await requireTeacher();

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false as const, error: "Enter a name, valid email and password of at least 8 characters." };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await rawPrisma.teacher.findUnique({ where: { email } });
  if (existing) {
    return { ok: false as const, error: "An account with that email already exists." };
  }

  await rawPrisma.teacher.create({
    data: {
      id: crypto.randomUUID(),
      name: parsed.data.name,
      email,
      passwordHash: hashPassword(parsed.data.password),
    },
  });

  revalidatePath("/settings");
  return { ok: true as const };
}

"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth/session";
import { rawPrisma } from "@/lib/db/raw";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createParentPortal(studentId: string, showFees = false) {
  const teacher = await requireTeacher();
  const student = await rawPrisma.student.findFirst({ where: { id: studentId, teacherId: teacher.id } });
  if (!student) throw new Error("Student not found.");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90);

  await rawPrisma.parentPortal.updateMany({
    where: { studentId, teacherId: teacher.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await rawPrisma.parentPortal.create({
    data: {
      id: crypto.randomUUID(),
      teacherId: teacher.id,
      studentId,
      tokenHash: hashToken(token),
      showFees,
      expiresAt,
    },
  });

  revalidatePath("/settings");
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://tutor-ledger-sigma.vercel.app";
  return { url: `${origin}/portal/${token}`, expiresAt: expiresAt.toISOString() };
}

export async function revokeParentPortal(portalId: string) {
  const teacher = await requireTeacher();
  await rawPrisma.parentPortal.updateMany({
    where: { id: portalId, teacherId: teacher.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  revalidatePath("/settings");
}

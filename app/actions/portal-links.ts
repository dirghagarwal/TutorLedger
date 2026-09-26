"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth/session";
import { rawPrisma } from "@/lib/db/raw";

function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
function origin() { return process.env.NEXT_PUBLIC_APP_URL ?? "https://tutor-ledger-tutor-ledger.vercel.app"; }

async function createPortal(studentId: string, kind: "student" | "parent", showFees = false) {
  const teacher = await requireTeacher();
  const student = await rawPrisma.student.findFirst({ where: { id: studentId, teacherId: teacher.id } });
  if (!student) throw new Error("Student not found.");
  const token = `${kind}_` + randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 180);
  await rawPrisma.parentPortal.create({ data: { id: crypto.randomUUID(), teacherId: teacher.id, studentId, tokenHash: hashToken(token), showFees: kind === "parent" ? showFees : false, expiresAt } });
  revalidatePath("/settings");
  return { url: `${origin()}/portal/${token}`, expiresAt: expiresAt.toISOString() };
}

export async function createStudentAccessLink(studentId: string) { return createPortal(studentId, "student", false); }
export async function createParentAccessLink(studentId: string, showFees = false) { return createPortal(studentId, "parent", showFees); }

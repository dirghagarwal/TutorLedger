"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudentPortalAuth } from "@/lib/auth/parent-portal";
import { rawPrisma } from "@/lib/db/raw";

const schema = z.object({ sessionId: z.string().min(1), topic: z.string().max(300).optional(), classwork: z.string().max(2000).optional(), homework: z.string().max(2000).optional() });

export async function studentUpdateClassRecord(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const portal = await requireStudentPortalAuth();
    if (portal.role !== "student") return { ok: false, error: "Parent access is read-only." };
    const values = schema.parse(input);
    const session = await rawPrisma.session.findFirst({ where: { id: values.sessionId, studentId: portal.studentId, teacherId: portal.teacherId } });
    if (!session) return { ok: false, error: "Session not found." };
    const existing = await rawPrisma.sessionNote.findFirst({ where: { sessionId: session.id, teacherId: portal.teacherId } });
    if (existing) await rawPrisma.sessionNote.update({ where: { id: existing.id }, data: { ...(values.topic !== undefined ? { topic: values.topic } : {}), ...(values.classwork !== undefined ? { classwork: values.classwork } : {}), ...(values.homework !== undefined ? { homework: values.homework } : {}) } });
    else await rawPrisma.sessionNote.create({ data: { id: crypto.randomUUID(), teacherId: portal.teacherId, sessionId: session.id, topic: values.topic ?? "Session Notes", classwork: values.classwork ?? "", homework: values.homework ?? "", remarks: "" } });
    revalidatePath("/portal");
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to update class record." }; }
}

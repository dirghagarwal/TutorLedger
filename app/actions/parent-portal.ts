"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudentPortalAuth } from "@/lib/auth/parent-portal";
import { requireTeacher } from "@/lib/auth/session";
import { rawPrisma } from "@/lib/db/raw";
import { validateAttachmentFile } from "@/lib/validations/session";
import { AttachmentType } from "@/types/attachment";

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


/** Backward-compatible action used by the student profile portal controls. */
export async function revokeParentPortals(studentId: string) {
  const teacher = await requireTeacher();
  await rawPrisma.parentPortal.updateMany({
    where: { studentId, teacherId: teacher.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  revalidatePath("/settings");
  revalidatePath(`/students/${studentId}`);
}

const studentNotesInputSchema = z.object({
  sessionId: z.string().min(1),
  topic: z.string().max(300).optional(),
  classwork: z.string().max(2000).optional(),
});

export async function studentUpdateSessionNotesAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const portal = await requireStudentPortalAuth();
    const values = studentNotesInputSchema.parse(input);

    const session = await rawPrisma.session.findFirst({
      where: {
        id: values.sessionId,
        studentId: portal.studentId,
        teacherId: portal.teacherId,
      },
    });
    if (!session) return { ok: false, error: "Session not found." };

    const existingNote = await rawPrisma.sessionNote.findFirst({
      where: {
        sessionId: session.id,
        teacherId: portal.teacherId,
      },
    });

    if (existingNote) {
      await rawPrisma.sessionNote.update({
        where: { id: existingNote.id },
        data: {
          ...(values.topic !== undefined ? { topic: values.topic } : {}),
          ...(values.classwork !== undefined ? { classwork: values.classwork } : {}),
        },
      });
    } else {
      await rawPrisma.sessionNote.create({
        data: {
          id: crypto.randomUUID(),
          teacherId: portal.teacherId,
          sessionId: session.id,
          topic: values.topic || "Session Notes",
          classwork: values.classwork || "",
          homework: "",
          remarks: "",
        },
      });
    }

    revalidatePath("/portal");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to update session notes." };
  }
}

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const studentRescheduleInputSchema = z
  .object({
    sessionId: z.string().min(1),
    startTime: z.string().regex(timeRegex, "Start time must be HH:MM"),
    endTime: z.string().regex(timeRegex, "End time must be HH:MM"),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time.",
    path: ["endTime"],
  });

export async function studentRescheduleSessionAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const portal = await requireStudentPortalAuth();
    const values = studentRescheduleInputSchema.parse(input);

    const session = await rawPrisma.session.findFirst({
      where: {
        id: values.sessionId,
        studentId: portal.studentId,
        teacherId: portal.teacherId,
      },
    });
    if (!session) return { ok: false, error: "Session not found." };

    const collision = await rawPrisma.session.findFirst({
      where: {
        studentId: portal.studentId,
        teacherId: portal.teacherId,
        date: session.date,
        startTime: values.startTime,
        id: { not: session.id },
      },
    });
    if (collision) {
      return { ok: false, error: "Another class is already scheduled at that time." };
    }

    await rawPrisma.$transaction([
      rawPrisma.session.update({
        where: { id: session.id },
        data: {
          startTime: values.startTime,
          endTime: values.endTime,
        },
      }),
      rawPrisma.attendance.updateMany({
        where: { sessionId: session.id, teacherId: portal.teacherId },
        data: {
          startTime: values.startTime,
          endTime: values.endTime,
        },
      }),
    ]);

    revalidatePath("/portal");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to reschedule session." };
  }
}

export async function studentCancelSessionAction(
  sessionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const portal = await requireStudentPortalAuth();

    const session = await rawPrisma.session.findFirst({
      where: {
        id: sessionId,
        studentId: portal.studentId,
        teacherId: portal.teacherId,
      },
    });
    if (!session) return { ok: false, error: "Session not found." };
    if (session.status === "CANCELLED") {
      return { ok: false, error: "Session is already cancelled." };
    }

    const allocationCount = await rawPrisma.paymentAllocation.count({
      where: { sessionId: session.id, teacherId: portal.teacherId },
    });
    if (allocationCount > 0) {
      return {
        ok: false,
        error: "Cannot cancel a class with allocated payments. Please contact your tutor.",
      };
    }

    await rawPrisma.$transaction([
      rawPrisma.session.update({
        where: { id: session.id },
        data: { status: "CANCELLED" },
      }),
      rawPrisma.attendance.updateMany({
        where: { sessionId: session.id, teacherId: portal.teacherId },
        data: { status: "CANCELLED" },
      }),
      rawPrisma.auditLog.create({
        data: {
          id: crypto.randomUUID(),
          teacherId: portal.teacherId,
          studentId: portal.studentId,
          sessionId: session.id,
          action: "STUDENT_SESSION_CANCELLED",
          userPrompt: "Cancellation submitted via Student Portal",
          result: `Session ${session.id} on ${session.date} cancelled by student.`,
          resolvedDate: session.date,
        },
      }),
    ]);

    revalidatePath("/portal");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to cancel session." };
  }
}

export async function studentUploadAttachmentAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const portal = await requireStudentPortalAuth();
    const sessionId = String(formData.get("sessionId") ?? "");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose a file to upload." };
    }

    const session = await rawPrisma.session.findFirst({
      where: {
        id: sessionId,
        studentId: portal.studentId,
        teacherId: portal.teacherId,
      },
    });
    if (!session) return { ok: false, error: "Session not found." };

    const bytes = await file.arrayBuffer();
    const uint8 = new Uint8Array(bytes);
    const validation = validateAttachmentFile(file.name, file.type, file.size, uint8);
    if (!validation.valid) {
      return { ok: false, error: validation.error ?? "Invalid attachment file." };
    }

    const base64 = Buffer.from(bytes).toString("base64");
    const safeMime = file.type || "application/octet-stream";
    const storagePath = `data:${safeMime};base64,${base64}`;

    await rawPrisma.attachment.create({
      data: {
        id: crypto.randomUUID(),
        teacherId: portal.teacherId,
        sessionId: session.id,
        type: validation.inferredType ?? AttachmentType.FILE,
        filename: file.name,
        storagePath,
      },
    });

    revalidatePath("/portal");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to upload attachment." };
  }
}

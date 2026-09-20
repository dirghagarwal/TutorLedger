import { prisma } from "@/lib/db/prisma";
import { getRequestTeacherId } from "@/lib/auth/session";
import { AttachmentType, type Attachment } from "@/types/attachment";

function toAttachment(record: Awaited<ReturnType<typeof prisma.attachment.findMany>>[number]): Attachment {
  return { ...record, type: record.type as AttachmentType, uploadedAt: record.uploadedAt.toISOString() };
}

export async function findAttachmentsBySessionIds(sessionIds: readonly string[]): Promise<Attachment[]> {
  if (sessionIds.length === 0) return [];
  const records = await prisma.attachment.findMany({ where: { sessionId: { in: [...sessionIds] } }, orderBy: { uploadedAt: "desc" } });
  return records.map(toAttachment);
}

export async function findAttachmentsBySession(sessionId: string): Promise<Attachment[]> {
  const records = await prisma.attachment.findMany({ where: { sessionId }, orderBy: { uploadedAt: "desc" } });
  return records.map(toAttachment);
}

export async function findAttachments(): Promise<Attachment[]> {
  const records = await prisma.attachment.findMany({ orderBy: { uploadedAt: "desc" } });
  return records.map(toAttachment);
}

export async function createAttachment(input: Omit<Attachment, "uploadedAt">): Promise<Attachment> {
  const teacherId = await getRequestTeacherId();
  if (!teacherId) throw new Error("UNAUTHENTICATED");
  const record = await prisma.attachment.create({ data: { ...input, teacherId } as never });
  return toAttachment(record);
}

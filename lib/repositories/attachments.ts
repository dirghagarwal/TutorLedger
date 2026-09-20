import { tenantPrisma } from "@/lib/db/tenant-prisma";
import { AttachmentType, type Attachment } from "@/types/attachment";

function toAttachment(record: Awaited<ReturnType<typeof tenantPrisma.attachment.findMany>>[number]): Attachment {
  return { ...record, type: record.type as AttachmentType, uploadedAt: record.uploadedAt.toISOString() };
}

export async function findAttachmentsBySessionIds(sessionIds: readonly string[]): Promise<Attachment[]> {
  if (sessionIds.length === 0) return [];
  const records = await tenantPrisma.attachment.findMany({ where: { sessionId: { in: [...sessionIds] } }, orderBy: { uploadedAt: "desc" } });
  return records.map(toAttachment);
}

export async function findAttachmentsBySession(sessionId: string): Promise<Attachment[]> {
  const records = await tenantPrisma.attachment.findMany({ where: { sessionId }, orderBy: { uploadedAt: "desc" } });
  return records.map(toAttachment);
}

export async function findAttachments(): Promise<Attachment[]> {
  const records = await tenantPrisma.attachment.findMany({ orderBy: { uploadedAt: "desc" } });
  return records.map(toAttachment);
}

export async function createAttachment(input: Omit<Attachment, "uploadedAt">): Promise<Attachment> {
    const record = await tenantPrisma.attachment.create({ data: input as never });
  return toAttachment(record);
}

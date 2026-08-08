export enum AttachmentType {
  IMAGE = "IMAGE",
  PDF = "PDF",
  FILE = "FILE",
}

export interface Attachment {
  id: string;
  sessionId: string;
  type: AttachmentType;
  filename: string;
  storagePath: string;
  uploadedAt: string;
}
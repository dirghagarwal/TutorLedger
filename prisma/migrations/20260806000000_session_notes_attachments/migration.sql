ALTER TABLE "Session" ADD COLUMN "startedAt" TEXT;
ALTER TABLE "Session" ADD COLUMN "endedAt" TEXT;
ALTER TABLE "Session" ADD COLUMN "durationMinutes" INTEGER;

CREATE TABLE "SessionNote" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "classwork" TEXT NOT NULL,
  "homework" TEXT NOT NULL,
  "remarks" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SessionNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Attachment" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SessionNote_sessionId_createdAt_idx" ON "SessionNote"("sessionId", "createdAt");
CREATE INDEX "Attachment_sessionId_uploadedAt_idx" ON "Attachment"("sessionId", "uploadedAt");

ALTER TABLE "SessionNote" ADD CONSTRAINT "SessionNote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
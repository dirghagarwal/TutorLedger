CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "studentId" TEXT,
  "sessionId" TEXT,
  "resolvedDate" TEXT,
  "userPrompt" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_teacherId_createdAt_idx" ON "AuditLog"("teacherId", "createdAt");
CREATE INDEX "AuditLog_teacherId_action_createdAt_idx" ON "AuditLog"("teacherId", "action", "createdAt");
CREATE INDEX "AuditLog_studentId_createdAt_idx" ON "AuditLog"("studentId", "createdAt");

ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

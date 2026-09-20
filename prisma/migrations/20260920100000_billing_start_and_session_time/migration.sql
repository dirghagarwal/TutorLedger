-- TutorLedger V2 billing and session integrity
-- Safe additive change: existing Session rows were already limited to one row per student/date.
-- The new constraint retains all existing rows and permits multiple times on the same date.

ALTER TABLE "Student"
ADD COLUMN IF NOT EXISTS "billingStartMonth" TEXT;

DROP INDEX IF EXISTS "Session_studentId_date_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Session_studentId_date_startTime_key"
ON "Session"("studentId", "date", "startTime");

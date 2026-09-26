ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "coveredMonth" TEXT,
  ADD COLUMN IF NOT EXISTS "coveredFromDate" TEXT,
  ADD COLUMN IF NOT EXISTS "coveredToDate" TEXT,
  ADD COLUMN IF NOT EXISTS "coveredClassCount" INTEGER;

CREATE INDEX IF NOT EXISTS "Payment_studentId_coveredMonth_idx"
  ON "Payment" ("studentId", "coveredMonth");

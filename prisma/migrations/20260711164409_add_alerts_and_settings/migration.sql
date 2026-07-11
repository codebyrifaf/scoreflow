-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "alertedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedBy" TEXT;

-- AlterTable
ALTER TABLE "Owner" ADD COLUMN     "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "digestEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "alertThreshold" INTEGER NOT NULL DEFAULT 5;

-- CreateIndex
CREATE INDEX "Feedback_restaurantId_resolvedAt_idx" ON "Feedback"("restaurantId", "resolvedAt");

-- Backfill: treat every PRE-EXISTING feedback row as "already alerted".
-- Without this, `alertedAt` would be NULL on all history, so the first time an
-- alert fires (or the day email is switched on) we'd email the owner about every
-- complaint they ever received. This only stamps old rows; it changes nothing a
-- user can see, and new rows still arrive with alertedAt = NULL as intended.
UPDATE "Feedback" SET "alertedAt" = "createdAt";

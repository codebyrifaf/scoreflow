-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "ipHash" TEXT;

-- CreateIndex
CREATE INDEX "Feedback_ipHash_createdAt_idx" ON "Feedback"("ipHash", "createdAt");

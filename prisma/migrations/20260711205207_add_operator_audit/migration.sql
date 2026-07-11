-- CreateTable
CREATE TABLE "OperatorAudit" (
    "id" SERIAL NOT NULL,
    "operatorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetBrandId" INTEGER NOT NULL,
    "targetLabel" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperatorAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperatorAudit_createdAt_idx" ON "OperatorAudit"("createdAt");

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "monthlyPrice" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "brandId" INTEGER NOT NULL,
    "amountBdt" INTEGER NOT NULL,
    "periodDays" INTEGER NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_brandId_idx" ON "Payment"("brandId");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

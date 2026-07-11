-- CreateTable
CREATE TABLE "Feedback" (
    "id" SERIAL NOT NULL,
    "restaurant" TEXT NOT NULL,
    "table" TEXT,
    "orderNumber" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

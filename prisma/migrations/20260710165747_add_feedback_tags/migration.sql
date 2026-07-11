-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

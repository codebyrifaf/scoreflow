-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "blockedReviewPlatforms" TEXT[] DEFAULT ARRAY[]::TEXT[];

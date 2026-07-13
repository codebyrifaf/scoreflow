-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "reviewClickedPlatform" TEXT;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "tripadvisorUrl" TEXT,
ADD COLUMN     "yelpUrl" TEXT,
ADD COLUMN     "zomatoUrl" TEXT;

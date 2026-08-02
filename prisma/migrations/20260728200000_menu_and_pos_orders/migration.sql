-- Order-aware feedback chips: the account's MENU, and the ORDERS its till pushes.
--
-- `Feedback.orderNumber` has always been a string the diner types, with nothing
-- behind it. These two tables are what finally give it meaning: the till says
-- "order 102 = chicken cheese burger", so a diner rating it 3/10 is offered
-- "Burger was dry" instead of the generic "Food was cold" — without being asked
-- anything extra.
--
-- ✅ FULLY ADDITIVE — reviewed statement by statement before applying. Every line
-- is a CREATE or an ADD; there is no DROP and no column rename anywhere, so no
-- existing row loses data. (M23's GBP rename is why this gets checked every time:
-- Prisma emits renames as DROP + ADD, which destroys the column's contents.)
--
-- ⚠️ Both new foreign keys are ON DELETE RESTRICT, like every other FK in this
-- schema. That means `deleteBrandCascade` and `deleteRestaurantCascade` MUST learn
-- to delete these rows first, or closing an account fails outright the moment it
-- has a menu or a single order. That is exactly the trap M21 hit with `Payment`.

-- AlterTable: what the diner actually ate, snapshotted at submit time.
-- A plain array of names, deliberately not a relation — see the schema comment.
ALTER TABLE "Feedback" ADD COLUMN     "dishNames" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: the per-restaurant POS key. Stored HASHED, never in plaintext.
ALTER TABLE "Restaurant" ADD COLUMN     "posKeyHash" TEXT,
ADD COLUMN     "posKeyPrefix" TEXT;

-- CreateTable
CREATE TABLE "PosOrder" (
    "id" SERIAL NOT NULL,
    "restaurantId" INTEGER NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "items" TEXT[],
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" SERIAL NOT NULL,
    "brandId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "positiveChips" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "negativeChips" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chipsSource" TEXT NOT NULL DEFAULT 'template',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: THE hot lookup — "this restaurant's order 102, placed recently".
-- Runs on the diner's path, so it must never be a scan.
CREATE INDEX "PosOrder_restaurantId_orderNumber_createdAt_idx" ON "PosOrder"("restaurantId", "orderNumber", "createdAt");

-- CreateIndex: the 24-hour pruning sweep.
CREATE INDEX "PosOrder_createdAt_idx" ON "PosOrder"("createdAt");

-- CreateIndex: a till that retries must not create duplicate orders.
CREATE UNIQUE INDEX "PosOrder_restaurantId_orderNumber_placedAt_key" ON "PosOrder"("restaurantId", "orderNumber", "placedAt");

-- CreateIndex
CREATE INDEX "MenuItem_brandId_active_idx" ON "MenuItem"("brandId", "active");

-- CreateIndex: one dish of a given name per account.
CREATE UNIQUE INDEX "MenuItem_brandId_name_key" ON "MenuItem"("brandId", "name");

-- CreateIndex: authenticating an incoming order is one indexed lookup on the hash,
-- never a scan over every restaurant.
CREATE UNIQUE INDEX "Restaurant_posKeyHash_key" ON "Restaurant"("posKeyHash");

-- AddForeignKey
ALTER TABLE "PosOrder" ADD CONSTRAINT "PosOrder_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

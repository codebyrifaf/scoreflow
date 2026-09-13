-- Square integration, step 2: orders arriving from Square.
--
-- Purely ADDITIVE. Three new columns, each with a default, so every existing row
-- stays valid as-is (existing orders all came from till keys: source = 'key', no
-- external id, no match keys). Generated with `prisma migrate diff
-- --from-config-datasource` and read through by hand before applying (M23).

ALTER TABLE "PosOrder" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "matchKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'key';

-- One row per Square order per branch, however many times Square announces it
-- (created, then updated, then paid). NULLs never collide, so key-till orders —
-- which have no external id — are unaffected.
CREATE UNIQUE INDEX "PosOrder_restaurantId_externalId_key" ON "PosOrder"("restaurantId", "externalId");

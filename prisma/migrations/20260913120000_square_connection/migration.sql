-- Square integration, step 1: "Connect Square".
--
-- Purely ADDITIVE — a new nullable column and a new table. No existing row, column
-- or constraint is changed, so this is safe to apply to a database that holds real
-- data. Generated with `prisma migrate diff --from-config-datasource` and read
-- through by hand before applying (the M23 rule: never trust a generated migration
-- blind — Prisma renders renames as DROP + ADD).

-- Which Square location feeds each branch. Null = not linked (the normal state).
ALTER TABLE "Restaurant" ADD COLUMN     "squareLocationId" TEXT;

-- One Square connection per account. Tokens are stored ENCRYPTED (lib/token-crypto.ts).
CREATE TABLE "SquareConnection" (
    "id" SERIAL NOT NULL,
    "brandId" INTEGER NOT NULL,
    "merchantId" TEXT NOT NULL,
    "merchantName" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SquareConnection_pkey" PRIMARY KEY ("id")
);

-- One connection per account, and one account per Square business.
CREATE UNIQUE INDEX "SquareConnection_brandId_key" ON "SquareConnection"("brandId");
CREATE UNIQUE INDEX "SquareConnection_merchantId_key" ON "SquareConnection"("merchantId");

-- One branch per Square location.
CREATE UNIQUE INDEX "Restaurant_squareLocationId_key" ON "Restaurant"("squareLocationId");

-- ⚠️ ON DELETE RESTRICT, like every FK here: deleteBrandCascade MUST delete the
-- connection before the brand, or closing a Square-connected account fails (M21).
ALTER TABLE "SquareConnection" ADD CONSTRAINT "SquareConnection_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

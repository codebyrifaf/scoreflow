-- Milestone 23: UK readiness.
--
-- Prisma's generated version of this migration used DROP COLUMN + ADD COLUMN, which
-- would have DESTROYED the data in all three columns. These tables happen to be
-- empty today, but shipping a destructive migration is how you lose a customer's
-- billing history later. Rewritten by hand as proper RENAMEs, which preserve values.

-- 1. `reviewThreshold` no longer decides who is INVITED to leave a Google review
--    (that was review gating — every diner is now invited). It only sets the tone
--    of the follow-up questions, so the name had to stop lying.
ALTER TABLE "Restaurant" RENAME COLUMN "reviewThreshold" TO "positiveThreshold";

-- 2. Money is now GBP, stored in PENCE as an integer (£19.99 = 1999).
--    Safe to rename rather than recreate: no payments exist yet, and every
--    monthlyPrice is still 0 — so there are no taka amounts to mis-convert.
ALTER TABLE "Brand" RENAME COLUMN "monthlyPrice" TO "monthlyPricePence";
ALTER TABLE "Payment" RENAME COLUMN "amountBdt" TO "amountPence";

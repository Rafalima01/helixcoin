-- Commercial model is percentage-only: drop every CPA configuration knob.
--
-- Only the two CONFIG columns are dropped. The CommissionSourceType.CPA_FTD
-- enum value and any historical Commission rows carrying it are deliberately
-- left untouched: those rows are settled financial facts (money already
-- credited to affiliates), and removing them would corrupt historical
-- commission totals and net-profit reporting. Postgres also refuses to drop
-- an enum value that existing rows still reference.
--
-- No new CPA_FTD row can be created after this migration, because the code
-- path that generated them was removed (see commission.service.ts).

ALTER TABLE "AffiliateSettings" DROP COLUMN IF EXISTS "cpaAmountCents";
ALTER TABLE "AffiliateProfile" DROP COLUMN IF EXISTS "cpaOverrideCents";

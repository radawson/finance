-- Original principal / starting value and typical monthly payment on vendor
-- accounts (loans, mortgages, etc.). Money uses DECIMAL(12, 2).
ALTER TABLE "vendor_accounts"
  ADD COLUMN "initialValue" DECIMAL(12, 2),
  ADD COLUMN "avgMonthlyPayment" DECIMAL(12, 2);

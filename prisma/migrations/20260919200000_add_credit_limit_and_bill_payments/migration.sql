-- Revolving credit limit on vendor accounts; statement minimum and actual
-- payment on bills. Money uses DECIMAL.
ALTER TABLE "vendor_accounts" ADD COLUMN IF NOT EXISTS "creditLimit" DECIMAL(12, 2);
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "minimumPayment" DECIMAL(10, 2);
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "paidAmount" DECIMAL(10, 2);

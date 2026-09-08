-- Backfill the unified ledger from existing PAID bills, and mark categories
-- that already have a recurring obligation as FIXED.
--
-- Idempotent: safe to re-run. Does not touch users, vendors, unpaid bills,
-- attachments, comments, notes, or dashboard prefs.

INSERT INTO "expenses" (
  "id",
  "date",
  "amount",
  "categoryId",
  "payee",
  "note",
  "vendorId",
  "billId",
  "createdById",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  COALESCE(b."paidDate", b."dueDate"),
  b."amount",
  b."categoryId",
  COALESCE(v."name", b."title"),
  NULL,
  b."vendorId",
  b."id",
  b."createdById",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "bills" b
LEFT JOIN "vendors" v ON v."id" = b."vendorId"
WHERE b."status" = 'PAID'
  AND NOT EXISTS (
    SELECT 1 FROM "expenses" e WHERE e."billId" = b."id"
  );

-- Categories that already have a recurring bill are obligations (FIXED).
-- Everything else stays VARIABLE (the column default). Users can reclassify
-- on the /budget page.
UPDATE "categories" c
SET "kind" = 'FIXED'
WHERE EXISTS (
  SELECT 1
  FROM "bills" b
  WHERE b."categoryId" = c."id"
    AND b."isRecurring" = true
);

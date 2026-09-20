-- Built-in debt account types. Credit Card was only a bill category before,
-- so vendor accounts could not be tagged and the accounts report missed them.
INSERT INTO "account_types" ("id", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid(), v.name, v.description, NOW(), NOW()
FROM (VALUES
  ('Credit Card', 'Revolving credit card'),
  ('Loan', 'Installment loan'),
  ('Mortgage', 'Home mortgage'),
  ('HELOC', 'Home equity line of credit'),
  ('Line of Credit', 'Revolving line of credit')
) AS v(name, description)
WHERE NOT EXISTS (
  SELECT 1 FROM "account_types" t WHERE t."name" = v.name
);

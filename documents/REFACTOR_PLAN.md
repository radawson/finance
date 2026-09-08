# Refactor Plan: Data-Model Rework — Ledger / Obligation / Envelope

**Status:** Design finalized, awaiting go-ahead to start Phase 1. No code changed yet.

## Decisions locked
- **Multi-user preserved** — every new model/query keeps `createdById` scoping
  (`OR: [{ createdById: userId }, { createdById: null }]` for non-admins).
- **(A) Separate `Expense` model**, full model rework (not a bolt-on).
- **(A2) Unified ledger** — `Expense` is the single source of truth for all outflow. Marking a `Bill`
  paid auto-creates a linked `Expense` (`billId` set). One table powers history + burn-down.
- **(B) `Category.kind`** (`FIXED` / `VARIABLE`) drives projection source.
- **(C) `EnvelopePeriod`** carries `WEEKLY | MONTHLY | YEARLY`; UI ships monthly-only first.
- **(D)** Recurring-bill review happens against remote prod data during the ETL.
- **Migration:** rebuild local DB fresh + ETL/cherry-pick real rows from a **local `pg_dump` of prod**
  (tested against a real copy before touching remote). Per-trip grocery capture (date · amount ·
  store · category).

---

## 1. Why this is now simpler, not just different

A charge is either **still owed** (`Bill`) or **already spent** (`Expense`) — never both. Paying a
bill moves it from one to the other. That single invariant removes the entire class of problems the
old code fought:
- No `PREDICTED` rows polluting the ledger.
- No `status: { not: PREDICTED }` + `.filter(isActualBill)` double-guarding.
- No merge/reconcile step (`merge-forecast.ts` becomes unnecessary).
- No double-count rule needed for paid items — the data model enforces it.

| Concept | Definition | Source of projection | Storage |
|---|---|---|---|
| **Ledger** | All actual outflow (grocery trips + paid bills) | It *is* the historic picture | `Expense` |
| **Obligation** | Scheduled/recurring commitment not yet paid | Expand the recurrence schedule | `Bill` (+ `RecurrencePattern`) |
| **Envelope** | Monthly target for a `VARIABLE` category | Carry forward per month | `BudgetEnvelope` |

**Projected total for a month** = `sum(expenses already in month)` + `sum(unpaid obligations due in
month)` + `sum(max(0, envelope − variable-category spend so far))`. Paid obligations are already in
`expenses`, so they're never added twice.

---

## 2. Schema (`prisma/schema.prisma`)

### New enums
```prisma
enum CategoryKind   { FIXED  VARIABLE }
enum EnvelopePeriod { WEEKLY  MONTHLY  YEARLY }
```

### `BillStatus` — remove `PREDICTED` only
Keep `PENDING DUE_SOON OVERDUE PAID SKIPPED` (these are computed by `calculateBillStatus` and drive
existing badges/widgets — collapsing them would churn UI for no gain).

### New — `Expense` (the ledger)
```prisma
model Expense {
  id          String   @id @default(uuid())
  date        DateTime           // when money left
  amount      Decimal  @db.Decimal(10,2)
  categoryId  String
  payee       String?            // free-text store ("Tesco", "Shell")
  note        String?
  vendorId    String?            // optional structured vendor link
  billId      String?  @unique   // set when this expense is the payment of an obligation
  createdById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  category  Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  vendor    Vendor?  @relation(fields: [vendorId], references: [id], onDelete: SetNull)
  bill      Bill?    @relation(fields: [billId], references: [id], onDelete: SetNull)
  createdBy User?    @relation(fields: [createdById], references: [id], onDelete: SetNull)

  @@index([createdById, date])
  @@index([categoryId, date])
  @@map("expenses")
}
```

### New — `BudgetEnvelope`
```prisma
model BudgetEnvelope {
  id         String         @id @default(uuid())
  userId     String
  categoryId String
  amount     Decimal        @db.Decimal(10,2)
  period     EnvelopePeriod @default(MONTHLY)
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  category Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@unique([userId, categoryId])
  @@map("budget_envelopes")
}
```

### `Bill` — slim to "obligation"
- **Remove:** `templateBillId`, `predictionConfidence`, `predictionMethod`, and the
  `templateBill`/`predictions` self-relation.
- **Add:** `expense Expense?` back-relation (its payment).
- Keep recurrence, dueDate, status, amount, vendor/account links, tags, etc.

### Back-relations to add
- `Category`: `kind CategoryKind @default(VARIABLE)`, `envelopes BudgetEnvelope[]`, `expenses Expense[]`
- `User`: `budgetEnvelopes BudgetEnvelope[]`, `expenses Expense[]`
- `Vendor`: `expenses Expense[]`

### Out of scope (kept as-is)
`Vendor`, `VendorAccount`, `AccountType`, `VendorAccountBalanceSnapshot`, credit-card balance
tracking, notes, notifications, dashboard prefs.

---

## 3. The unified-ledger seam (one helper, one place)

`src/lib/business/ledger.ts` centralizes the coupling so it can't leak:
- `syncExpenseForBill(tx, bill)` — called inside the bill PATCH transaction:
  - status → `PAID`: upsert an `Expense { billId, date: paidDate, amount, categoryId, vendorId,
    payee: vendor?.name ?? title, createdById }`.
  - status away from `PAID`: delete the linked `Expense`.
  - amount/date/category edited while `PAID`: update the linked `Expense`.
- `getLedgerExpenses(filter)` — the single read path for all reporting.
- Aggregation helpers: `expensesByPeriod`, `categoryBreakdownFromExpenses`, `burnDown(envelopes, expenses)`.

`Bill.onDelete` for the linked expense handled here too (delete payment when obligation is deleted).

---

## 4. Code: delete / rewrite / add

### Delete
- `src/lib/business/prediction-generator.ts`
- `src/app/api/bills/predicted/route.ts`
- `src/lib/business/merge-forecast.ts` (no longer needed)
- `src/lib/business/__tests__/merge-forecast.test.ts`, `__tests__/recurring-bills-enhance.test.ts`
- In `recurring-bills.ts`: `linearRegression`, `weightedMovingAverage`, `seasonalAverage`,
  `calculateEnhancedAmount`, `removeAmountOutliers`, `boundPredictedAmount`, `adjustForWeekend`,
  `computeMedianDayOfMonth`, `calculateSimpleForecastAmount`, `enhancePredictionsWithActualData`.
  **Keep:** `shouldMatchBill`, `matchBillToRecurringPattern`, `isDateMatch`.
- In `analysis.ts`: `synthesizeVirtualBills`, `analyzeHistoricalPatterns`,
  `detectRecurrenceFromHistory`, the `includeAutoDetect` branch.

### Rewrite / simplify
- `src/lib/analysis.ts` → `expandObligations(recurringBills, start, end)` + envelope projection,
  reading actuals from `expenses`. Keep `groupBy*`/`formatPeriodLabel`.
- `src/lib/business/period-ledger.ts` → re-point at `Expense` (rename → `expense-ledger.ts`):
  `filterExpensesInPeriod`, `categoryBreakdownFromExpenses`. Drop `isActualBill` (obsolete).
- `src/app/api/stats/route.ts` → breakdown + burn-down from `expenses`; drop predicted counts/lists.
- `src/app/api/analysis/budget/route.ts` → new projection; actuals from `expenses`.
- `src/app/api/analysis/history/route.ts` → read `expenses`.
- `src/app/api/bills/route.ts` & `[id]/route.ts` → drop prediction fields + `includePredicted`;
  PATCH wires `syncExpenseForBill` in a transaction.
- `src/types/index.ts` → remove `PredictionMethod`/prediction fields/`PREDICTED`; add `Expense`,
  `BudgetEnvelope`, `CategoryKind`, envelope + burn-down shapes; trim `DashboardStats`.

### Add
- `src/app/api/expenses/route.ts` (GET/POST) + `[id]/route.ts` (PATCH/DELETE) — user-scoped.
- `src/app/api/budget/envelopes/route.ts` (GET, upsert) + `[id]/route.ts` (DELETE).
- `src/components/QuickExpenseForm.tsx` — date · amount · category(default Groceries) · store · note.
- `src/app/expenses/page.tsx` — quick-add + recent expenses list.
- `src/app/budget/page.tsx` — per-category monthly amount + FIXED/VARIABLE toggle.
- UI edits: `dashboard/page.tsx` + `dashboard-layout.ts` (burn-down widget; `EXPECTED_BILLS` →
  "Upcoming obligations"; "Log expense" button); `BillStatusBadge`, `BillCard`, `BillEditForm`,
  `bills/[id]/page.tsx` (remove PREDICTED; show linked expense when paid); `BudgetPredictionsView`
  (projected = obligations + envelopes, add target column); `CategoryModal` (kind selector);
  `MarkdownExporter` (drop prediction cols; add expense/envelope export).

---

## 5. Migration & ETL

1. New schema → fresh local DB (`prisma migrate reset` + updated `seed.ts` with category kinds).
2. `pg_dump` prod → restore into a local staging DB.
3. `scripts/migrate-prod-data.ts` (ETL, idempotent, dry-run-able):
   - drop all `PREDICTED` rows;
   - old `Bill` → new `Bill` (obligation) minus prediction columns;
   - **paid** old bills → also create linked `Expense` (date=paidDate, amount, category, vendor);
   - classify each `Category` as FIXED/VARIABLE (review step — this is decision D);
   - optionally seed `BudgetEnvelope`s from observed variable-category averages (proposed, for review).
4. Validate counts/totals against staging, then run on remote in a maintenance window (backup first).

---

## 6. Sequencing (branch per phase, each shippable)
1. **Schema rework + cleanup** — new schema, rebuild local, delete prediction code, green build.
2. **Ledger + obligations** — `Expense` wired, `syncExpenseForBill`, reporting reads `expenses`,
   simplified projection.
3. **Envelopes** — API + `/budget` page + projection/burn-down wiring.
4. **Per-trip expenses UI** — `QuickExpenseForm` + `/expenses` + dashboard entry.
5. **Dashboard** — burn-down + obligations widgets.
6. **Prod ETL** — write against local dump, validate, run on remote.

## 7. Tests to add
- `syncExpenseForBill`: pay → creates expense; un-pay → removes; edit-while-paid → updates.
- `expandObligations` + envelope projection.
- No-double-count: a paid obligation appears once (as an expense), never also as a projected bill.

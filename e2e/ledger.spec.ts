import { test, expect } from '@playwright/test'

/**
 * End-to-end visual coverage of the ledger refactor:
 *   - logging a per-trip expense
 *   - setting a budget envelope + burn-down
 *   - the dashboard surfacing ledger spend + the Log Expense action
 *   - a paid bill appearing as a read-only ledger expense
 *
 * Uses a unique run id so assertions target this run's rows in the shared dev DB.
 */
const RUN = Date.now()

test('log a per-trip grocery expense', async ({ page }) => {
  const payee = `Tesco-${RUN}`

  await page.goto('/expenses')
  await expect(page.getByRole('heading', { name: 'Expenses' })).toBeVisible()

  // Quick-add form: amount, category (Food), store.
  await page.locator('select').selectOption({ label: 'Food' })
  await page.locator('input[type="number"]').fill('73.50')
  await page.getByPlaceholder('e.g. Tesco').fill(payee)
  await page.getByRole('button', { name: /Log expense/i }).click()

  // The new expense appears in the recent list.
  const row = page.getByRole('row', { name: new RegExp(payee) })
  await expect(row).toBeVisible()
  await expect(row.getByText('$73.50')).toBeVisible()
  // Date must render as *today* (guards the date-only timezone off-by-one).
  const todayLabel = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  await expect(row.getByText(todayLabel)).toBeVisible()

  await page.screenshot({ path: 'e2e/screenshots/01-expenses.png', fullPage: true })
})

test('set a Food budget and see the burn-down', async ({ page }) => {
  await page.goto('/budget')
  await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible()

  const foodRow = page.getByRole('row', { name: /Food/ })
  const budgetInput = foodRow.getByRole('spinbutton')
  await budgetInput.fill('800')
  await budgetInput.blur()

  // Once a budget is set, the row shows a burn-down (left / over).
  await expect(foodRow.getByText(/left|over/)).toBeVisible()
  // Summary card (the <p>, not the table column header) reflects the budget.
  await expect(page.locator('p', { hasText: 'Monthly budget' })).toBeVisible()

  await page.screenshot({ path: 'e2e/screenshots/02-budget.png', fullPage: true })
})

test('dashboard surfaces ledger spend and the Log Expense action', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('link', { name: /Log Expense/i }).first()).toBeVisible()
  await expect(page.getByText('Category Breakdown')).toBeVisible()
  // Budget burn-down widget (Food envelope was set in the prior spec).
  await expect(page.getByText('Budget Burn-down (this month)')).toBeVisible()

  await page.screenshot({ path: 'e2e/screenshots/03-dashboard.png', fullPage: true })
})

test('a paid bill appears as a read-only ledger expense', async ({ page }) => {
  // Seed a PAID bill through the API (uses the authenticated session cookies).
  const cats = await (await page.request.get('/api/categories')).json()
  const elec = cats.find((c: { name: string }) => c.name === 'Electricity').id
  const now = new Date().toISOString()
  const res = await page.request.post('/api/bills', {
    data: {
      title: `E2E Power-${RUN}`,
      amount: '120.00',
      dueDate: now,
      categoryId: elec,
      status: 'PAID',
      paidDate: now,
    },
  })
  expect(res.status()).toBe(201)

  await page.goto('/expenses')
  const row = page.getByRole('row', { name: new RegExp(`E2E Power-${RUN}`) })
  await expect(row).toBeVisible()
  await expect(row.getByText('bill')).toBeVisible() // read-only badge
  await expect(row.getByRole('button')).toBeDisabled() // delete disabled

  await page.screenshot({ path: 'e2e/screenshots/04-bill-linked-expense.png', fullPage: true })
})

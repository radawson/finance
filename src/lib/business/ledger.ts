import { BillStatus, DecimalValue } from '@/types'

/**
 * The unified ledger seam.
 *
 * Expense is the single source of truth for actual outflow. When a Bill (an
 * obligation) is marked PAID, a linked Expense is created/updated (billId set);
 * when it leaves PAID, the linked Expense is removed. A charge is therefore
 * either still owed (a Bill) or already spent (an Expense) — never both — which
 * is what keeps the historic picture and budget burn-down free of double counting.
 *
 * All coupling between the Bill lifecycle and the ledger lives here.
 */

/** The bill fields needed to derive its ledger entry. Accepts Prisma rows (Decimal amount). */
export type BillForLedger = {
  id: string
  status: BillStatus
  paidDate?: Date | null
  dueDate: Date
  amount: DecimalValue
  categoryId: string
  vendorId?: string | null
  title: string
  createdById?: string | null
  vendor?: { name: string } | null
}

export interface ExpenseSyncData {
  date: Date
  amount: number
  categoryId: string
  vendorId: string | null
  payee: string
  createdById: string | null
}

export type ExpenseSyncPlan =
  | { action: 'upsert'; data: ExpenseSyncData }
  | { action: 'delete' }

/**
 * Decide what should happen to a bill's linked expense. Pure / unit-testable.
 * - PAID  -> the expense exists and mirrors the bill (date = paidDate, fallback dueDate)
 * - else  -> no expense should exist for this bill
 */
export function planExpenseForBill(bill: BillForLedger): ExpenseSyncPlan {
  if (bill.status === 'PAID') {
    return {
      action: 'upsert',
      data: {
        date: bill.paidDate ?? bill.dueDate,
        amount: Number(bill.amount),
        categoryId: bill.categoryId,
        vendorId: bill.vendorId ?? null,
        payee: bill.vendor?.name ?? bill.title,
        createdById: bill.createdById ?? null,
      },
    }
  }
  return { action: 'delete' }
}

/** Minimal transaction-client surface this module needs (keeps it decoupled from Prisma typings). */
export interface LedgerTx {
  expense: {
    upsert: (args: any) => Promise<any>
    deleteMany: (args: any) => Promise<any>
  }
}

/**
 * Reconcile the Expense linked to a bill, inside a transaction. Call this after
 * creating/updating a bill. `deleteMany` is used for the non-paid case so it is
 * a no-op when no linked expense exists.
 */
export async function syncExpenseForBill(tx: LedgerTx, bill: BillForLedger): Promise<void> {
  const plan = planExpenseForBill(bill)

  if (plan.action === 'upsert') {
    const amount = plan.data.amount.toFixed(2)
    await tx.expense.upsert({
      where: { billId: bill.id },
      create: {
        billId: bill.id,
        date: plan.data.date,
        amount,
        categoryId: plan.data.categoryId,
        vendorId: plan.data.vendorId,
        payee: plan.data.payee,
        createdById: plan.data.createdById,
      },
      update: {
        date: plan.data.date,
        amount,
        categoryId: plan.data.categoryId,
        vendorId: plan.data.vendorId,
        payee: plan.data.payee,
      },
    })
    return
  }

  await tx.expense.deleteMany({ where: { billId: bill.id } })
}

// ─── Ledger reads / aggregation (operate on already-fetched Expense[]) ───────

export function filterExpensesInPeriod<T extends { date: Date | string }>(
  expenses: T[],
  periodStart: Date,
  periodEnd: Date,
): T[] {
  const start = new Date(periodStart)
  start.setHours(0, 0, 0, 0)
  const end = new Date(periodEnd)
  end.setHours(23, 59, 59, 999)

  return expenses.filter((e) => {
    const d = new Date(e.date)
    return d >= start && d <= end
  })
}

export interface CategoryBreakdownEntry {
  categoryId: string
  categoryName: string
  color: string | null
  count: number
  totalAmount: number
}

/** Minimal expense shape for a category breakdown (accepts Prisma rows or Expense). */
type ExpenseForBreakdown = {
  categoryId: string
  amount: DecimalValue
  category?: { name: string; color?: string | null } | null
}

/** Category breakdown from ledger expenses (requires category on each expense). */
export function categoryBreakdownFromExpenses(expenses: ExpenseForBreakdown[]): CategoryBreakdownEntry[] {
  const map = new Map<string, CategoryBreakdownEntry>()

  for (const expense of expenses) {
    const categoryId = expense.categoryId
    const categoryName = expense.category?.name ?? 'Unknown'
    const color = expense.category?.color ?? null
    const amount = Number(expense.amount)
    const existing = map.get(categoryId)

    if (existing) {
      existing.count++
      existing.totalAmount += amount
    } else {
      map.set(categoryId, { categoryId, categoryName, color, count: 1, totalAmount: amount })
    }
  }

  return Array.from(map.values())
}

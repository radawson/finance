import { Bill, PredictedBill, DecimalValue } from '@/types'
import { findMatchingForecastSlot } from './recurring-bills'

export interface MergeableBill {
  title: string
  amount: number
  dueDate: Date
  categoryId: string
  vendorId?: string | null
  vendorAccountId?: string | null
  billId?: string
  source?: PredictedBill['source']
}

/**
 * Merge actual bills with forecast slots. Actuals win when a slot is fulfilled
 * (same vendor + due date within tolerance, title as tie-break).
 * Returns one row per obligation (no duplicate template + forecast for same slot).
 */
export function mergeBillsWithForecast(
  actuals: MergeableBill[],
  forecastSlots: MergeableBill[],
  toleranceDays: number = 2,
): MergeableBill[] {
  const result: MergeableBill[] = []
  const unused = [...forecastSlots]

  for (const actual of actuals) {
    const matched = findMatchingForecastSlot(actual, unused, toleranceDays)
    if (matched) {
      const idx = unused.indexOf(matched)
      if (idx >= 0) unused.splice(idx, 1)
    }
    result.push(actual)
  }

  result.push(...unused)

  return result.sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  )
}

export function billToMergeable(bill: Bill): MergeableBill {
  return {
    title: bill.title,
    amount: Number(bill.amount),
    dueDate: new Date(bill.dueDate),
    categoryId: bill.categoryId,
    vendorId: bill.vendorId,
    vendorAccountId: bill.vendorAccountId,
    billId: bill.id,
    source: 'recurrence',
  }
}

export function predictedBillToMergeable(pred: PredictedBill): MergeableBill {
  return {
    title: pred.title,
    amount: pred.amount,
    dueDate: new Date(pred.dueDate),
    categoryId: pred.categoryId ?? '',
    vendorId: pred.vendorId,
    vendorAccountId: pred.vendorAccountId,
    billId: pred.billId,
    source: pred.source,
  }
}

/** An actual ledger expense as a mergeable entry (source = 'actual'). */
export function expenseToMergeable(expense: {
  id?: string
  date: Date | string
  amount: DecimalValue
  categoryId: string
  vendorId?: string | null
  payee?: string | null
  billId?: string | null
  category?: { name?: string | null } | null
}): MergeableBill {
  return {
    title: expense.payee || expense.category?.name || 'Expense',
    amount: Number(expense.amount),
    dueDate: new Date(expense.date),
    categoryId: expense.categoryId,
    vendorId: expense.vendorId ?? null,
    vendorAccountId: null,
    billId: expense.billId ?? undefined,
    source: 'actual',
  }
}

export function mergeableToPredictedBill(entry: MergeableBill): PredictedBill {
  return {
    title: entry.title,
    amount: entry.amount,
    dueDate: entry.dueDate,
    source: entry.source ?? 'recurrence',
    billId: entry.billId,
    categoryId: entry.categoryId,
    vendorId: entry.vendorId,
    vendorAccountId: entry.vendorAccountId,
  }
}

/**
 * Category breakdown from merged ledger entries (requires category metadata lookup).
 */
export function categoryBreakdownFromMergeables(
  entries: MergeableBill[],
  categoryLookup: Map<
    string,
    { name: string; color: string | null }
  >,
): Array<{
  categoryId: string
  categoryName: string
  color: string | null
  count: number
  totalAmount: number
}> {
  const map = new Map<
    string,
    { categoryName: string; color: string | null; count: number; totalAmount: number }
  >()

  for (const entry of entries) {
    if (!entry.categoryId) continue
    const meta = categoryLookup.get(entry.categoryId)
    const categoryName = meta?.name ?? 'Unknown'
    const color = meta?.color ?? null
    const existing = map.get(entry.categoryId)

    if (existing) {
      existing.count++
      existing.totalAmount += entry.amount
    } else {
      map.set(entry.categoryId, {
        categoryName,
        color,
        count: 1,
        totalAmount: entry.amount,
      })
    }
  }

  return Array.from(map.entries()).map(([categoryId, data]) => ({
    categoryId,
    categoryName: data.categoryName,
    color: data.color,
    count: data.count,
    totalAmount: data.totalAmount,
  }))
}

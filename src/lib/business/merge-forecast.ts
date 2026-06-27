import { Bill, PredictedBill, DecimalValue } from '@/types'
import { isDateMatch } from './recurring-bills'

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

function matchGroupKey(
  categoryId: string,
  vendorId: string | null | undefined,
  vendorAccountId: string | null | undefined,
): string {
  return `${vendorId ?? 'null'}-${categoryId}-${vendorAccountId ?? 'null'}`
}

/**
 * Merge actual bills with forecast slots. Actuals win when dates match within tolerance.
 * Returns one row per obligation (no duplicate template + forecast for same slot).
 */
export function mergeBillsWithForecast(
  actuals: MergeableBill[],
  forecastSlots: MergeableBill[],
  toleranceDays: number = 3,
): MergeableBill[] {
  const result: MergeableBill[] = []
  const usedForecastIndices = new Set<number>()

  for (const actual of actuals) {
    const actualDate = new Date(actual.dueDate)
    const key = matchGroupKey(actual.categoryId, actual.vendorId, actual.vendorAccountId)

    let matchedForecastIdx = -1
    for (let i = 0; i < forecastSlots.length; i++) {
      if (usedForecastIndices.has(i)) continue
      const forecast = forecastSlots[i]
      const forecastKey = matchGroupKey(
        forecast.categoryId,
        forecast.vendorId,
        forecast.vendorAccountId,
      )
      if (forecastKey !== key) continue
      if (isDateMatch(actualDate, new Date(forecast.dueDate), toleranceDays)) {
        matchedForecastIdx = i
        break
      }
    }

    if (matchedForecastIdx >= 0) {
      usedForecastIndices.add(matchedForecastIdx)
    }

    result.push(actual)
  }

  for (let i = 0; i < forecastSlots.length; i++) {
    if (!usedForecastIndices.has(i)) {
      result.push(forecastSlots[i])
    }
  }

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

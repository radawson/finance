import { Bill } from '@/types'

/**
 * Bills that represent real spend events (not templates or system predictions).
 */
export function isActualBill(bill: Pick<Bill, 'status' | 'isRecurring'>): boolean {
  if (bill.status === 'PREDICTED') {
    return false
  }
  if (bill.isRecurring) {
    return false
  }
  return true
}

/**
 * Filter to actual bills with dueDate within [periodStart, periodEnd] (inclusive, day-normalized).
 */
export function filterActualBillsInPeriod(
  bills: Bill[],
  periodStart: Date,
  periodEnd: Date,
): Bill[] {
  const start = normalizeDayStart(periodStart)
  const end = normalizeDayEnd(periodEnd)

  return bills.filter((bill) => {
    if (!isActualBill(bill)) return false
    const due = normalizeDayStart(new Date(bill.dueDate))
    return due >= start && due <= end
  })
}

export function normalizeDayStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function normalizeDayEnd(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export interface CategoryBreakdownEntry {
  categoryId: string
  categoryName: string
  color: string | null
  count: number
  totalAmount: number
}

/**
 * Build category breakdown from actual bills (requires category on each bill).
 */
export function categoryBreakdownFromBills(bills: Bill[]): CategoryBreakdownEntry[] {
  const map = new Map<string, CategoryBreakdownEntry>()

  for (const bill of bills) {
    const categoryId = bill.categoryId
    const categoryName = bill.category?.name ?? 'Unknown'
    const categoryColor = bill.category?.color ?? null
    const amount = Number(bill.amount)
    const existing = map.get(categoryId)

    if (existing) {
      existing.count++
      existing.totalAmount += amount
    } else {
      map.set(categoryId, {
        categoryId,
        categoryName,
        color: categoryColor,
        count: 1,
        totalAmount: amount,
      })
    }
  }

  return Array.from(map.values())
}

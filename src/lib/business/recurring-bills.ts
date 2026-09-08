import { Bill } from '@/types'
import { differenceInDays, getMonth } from 'date-fns'

/**
 * Determines if a bill matches a recurring bill template
 * Bills match if they have the same vendor, vendor account, and category
 */
export function shouldMatchBill(bill: Bill, template: Bill): boolean {
  if (bill.categoryId !== template.categoryId) return false
  if (bill.vendorId !== template.vendorId) return false
  if (bill.vendorAccountId !== template.vendorAccountId) return false
  return true
}

/**
 * Finds which recurring bill template a given bill matches
 * Returns the template bill if a match is found, null otherwise
 */
export function matchBillToRecurringPattern(bill: Bill, recurringBills: Bill[]): Bill | null {
  const templates = recurringBills.filter((b) => b.recurrencePattern)
  for (const template of templates) {
    if (shouldMatchBill(bill, template)) return template
  }
  return null
}

/**
 * Checks if an actual due date matches a forecast date within a tolerance window (±3 days).
 */
export function isDateMatch(actualDate: Date, predictedDate: Date, toleranceDays: number = 3): boolean {
  return Math.abs(differenceInDays(actualDate, predictedDate)) <= toleranceDays
}

/**
 * Estimate the amount of a future recurring bill. Deterministic and explainable:
 *
 *   1. Seasonal — if there are ≥2 instances in the target calendar month across
 *      ≥2 different years, use that month's average (captures utility seasonality).
 *   2. Last-paid — otherwise use the most recent actual amount.
 *   3. Template — otherwise fall back to the template's set amount.
 *
 * `matchingHistory` should already be the bills that match the template
 * (same vendor/account/category); SKIPPED bills are ignored.
 */
export function estimateRecurringAmount(
  template: Bill,
  matchingHistory: Bill[],
  targetDate: Date,
): number {
  const history = matchingHistory.filter((b) => b.status !== 'SKIPPED')

  if (history.length === 0) return Number(template.amount)

  // 1. Seasonal
  const targetMonth = getMonth(targetDate)
  const sameMonth = history.filter((b) => getMonth(new Date(b.dueDate)) === targetMonth)
  const years = new Set(sameMonth.map((b) => new Date(b.dueDate).getFullYear()))
  if (sameMonth.length >= 2 && years.size >= 2) {
    return sameMonth.reduce((sum, b) => sum + Number(b.amount), 0) / sameMonth.length
  }

  // 2. Last-paid
  const mostRecent = [...history].sort(
    (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime(),
  )[0]
  return Number(mostRecent.amount)
}

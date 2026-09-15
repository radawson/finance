import { Bill } from '@/types'
import { differenceInDays, getMonth } from 'date-fns'

export function normalizeBillTitle(title: string): string {
  return title.trim().toLowerCase()
}

export function seriesKey(title: string, vendorId: string | null | undefined): string {
  return `${normalizeBillTitle(title)}::${vendorId ?? 'null'}`
}

export interface ForecastMatchable {
  title: string
  dueDate: Date | string
  vendorId?: string | null
}

/**
 * Series identity: bills belong to the same recurring obligation when they
 * share a normalized title and vendor (the spelling autocomplete keeps stable).
 */
export function shouldMatchBill(
  bill: Pick<Bill, 'title' | 'vendorId'>,
  template: Pick<Bill, 'title' | 'vendorId'>,
): boolean {
  if (normalizeBillTitle(bill.title) !== normalizeBillTitle(template.title)) return false
  if ((bill.vendorId ?? null) !== (template.vendorId ?? null)) return false
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
 * Checks if an actual due date matches a forecast date within a tolerance window (±2 days).
 */
export function isDateMatch(actualDate: Date, predictedDate: Date, toleranceDays: number = 2): boolean {
  return Math.abs(differenceInDays(actualDate, predictedDate)) <= toleranceDays
}

/**
 * Slot fulfillment: this entered bill is the predicted one for this cycle.
 *
 * 1. Candidates whose due date is within ±2 days
 * 2. Same vendorId as the entered bill
 * 3. If more than one candidate, keep the one with the same normalized title
 * 4. If still more than one, do not auto-match
 * 5. If the bill has no vendor, fall back to a unique title + date match
 */
export function findMatchingForecastSlot<T extends ForecastMatchable>(
  actual: ForecastMatchable,
  slots: T[],
  toleranceDays: number = 2,
): T | null {
  const actualDate = new Date(actual.dueDate)
  const dateMatches = slots.filter((slot) =>
    isDateMatch(actualDate, new Date(slot.dueDate), toleranceDays),
  )

  if (actual.vendorId) {
    const vendorMatches = dateMatches.filter(
      (slot) => (slot.vendorId ?? null) === actual.vendorId,
    )
    if (vendorMatches.length === 0) return null
    if (vendorMatches.length === 1) return vendorMatches[0]

    const titleMatches = vendorMatches.filter(
      (slot) => normalizeBillTitle(slot.title) === normalizeBillTitle(actual.title),
    )
    if (titleMatches.length === 1) return titleMatches[0]
    return null
  }

  const titleMatches = dateMatches.filter(
    (slot) => normalizeBillTitle(slot.title) === normalizeBillTitle(actual.title),
  )
  if (titleMatches.length === 1) return titleMatches[0]
  return null
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
 * (same normalized title and vendor); SKIPPED bills are ignored.
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

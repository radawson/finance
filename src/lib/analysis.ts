import { Bill, RecurrencePattern, AnalysisPeriod, PredictedBill, BudgetPredictionPeriodData } from '@/types'
import { RecurrenceFrequency } from '@/generated/prisma/client'
import { getUpcomingDueDates } from './recurrence'
import { format, getQuarter } from 'date-fns'
import { enhancePredictionsWithActualData } from './business/recurring-bills'

/**
 * Group bills by period (monthly, quarterly, yearly)
 */
export function groupBillsByPeriod(
  bills: Bill[],
  period: 'monthly' | 'quarterly' | 'yearly'
): Array<{
  periodLabel: string
  totalAmount: number
  billCount: number
  bills: Bill[]
}> {
  const grouped = new Map<string, { bills: Bill[]; totalAmount: number }>()

  bills.forEach((bill) => {
    const billDate = new Date(bill.dueDate)
    const periodLabel = formatPeriodLabel(billDate, period)

    const existing = grouped.get(periodLabel)
    if (existing) {
      existing.bills.push(bill)
      existing.totalAmount += Number(bill.amount)
    } else {
      grouped.set(periodLabel, {
        bills: [bill],
        totalAmount: Number(bill.amount),
      })
    }
  })

  return Array.from(grouped.entries())
    .map(([periodLabel, data]) => ({
      periodLabel,
      totalAmount: data.totalAmount,
      billCount: data.bills.length,
      bills: data.bills.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    }))
    .sort((a, b) => a.periodLabel.localeCompare(b.periodLabel))
}

/**
 * Format period label based on period type
 */
export function formatPeriodLabel(date: Date, period: 'monthly' | 'quarterly' | 'yearly' | 'custom'): string {
  switch (period) {
    case 'monthly':
      return format(date, 'yyyy-MM')
    case 'quarterly':
      return `${format(date, 'yyyy')}-Q${getQuarter(date)}`
    case 'yearly':
      return format(date, 'yyyy')
    default:
      return format(date, 'yyyy-MM-dd')
  }
}

/**
 * Generate budget predictions from recurrence patterns
 * Optionally merges with actual bills to replace predictions and enhance future predictions
 */
export function generateBudgetPredictions(
  recurringBills: Bill[],
  startDate: Date,
  endDate: Date,
  period: AnalysisPeriod,
  actualBills?: Bill[]
): BudgetPredictionPeriodData[] {
  const predictedBills: PredictedBill[] = []

  // Generate predictions for each recurring bill
  recurringBills.forEach((bill) => {
    if (!bill.recurrencePattern) return

    const pattern = bill.recurrencePattern
    const billStartDate = new Date(pattern.startDate)
    const effectiveStartDate = billStartDate > startDate ? billStartDate : startDate

    // Generate dates up to endDate or pattern endDate, whichever comes first
    const patternEndDate = pattern.endDate ? new Date(pattern.endDate) : endDate
    const effectiveEndDate = patternEndDate < endDate ? patternEndDate : endDate

    // Calculate how many periods we need to generate
    const maxCount = calculateMaxPeriods(effectiveStartDate, effectiveEndDate, pattern.frequency)

    const dates = getUpcomingDueDates(
      effectiveStartDate,
      pattern.frequency,
      pattern.dayOfMonth,
      effectiveEndDate,
      maxCount
    )

    dates.forEach((dueDate) => {
      // Only include dates within our range
      if (dueDate >= startDate && dueDate <= endDate) {
        predictedBills.push({
          title: bill.title,
          amount: Number(bill.amount),
          dueDate,
          source: 'recurrence',
          billId: bill.id,
          categoryId: bill.categoryId,
          vendorId: bill.vendorId,
        })
      }
    })
  })

  // Merge with actual bills if provided
  let finalPredictions = predictedBills
  if (actualBills && actualBills.length > 0) {
    finalPredictions = enhancePredictionsWithActualData(predictedBills, actualBills, recurringBills)
  }

  // Group predicted bills by period
  if (period === 'custom') {
    // For custom, group by the actual period type (default to monthly)
    return groupPredictedBillsByPeriod(finalPredictions, 'monthly')
  }

  return groupPredictedBillsByPeriod(finalPredictions, period)
}

/**
 * Group predicted bills by period
 */
function groupPredictedBillsByPeriod(
  predictedBills: PredictedBill[],
  period: 'monthly' | 'quarterly' | 'yearly'
): BudgetPredictionPeriodData[] {
  const grouped = new Map<string, { bills: PredictedBill[]; totalAmount: number }>()

  predictedBills.forEach((bill) => {
    const periodLabel = formatPeriodLabel(bill.dueDate, period)

    const existing = grouped.get(periodLabel)
    if (existing) {
      existing.bills.push(bill)
      existing.totalAmount += bill.amount
    } else {
      grouped.set(periodLabel, {
        bills: [bill],
        totalAmount: bill.amount,
      })
    }
  })

  return Array.from(grouped.entries())
    .map(([periodLabel, data]) => ({
      periodLabel,
      predictedAmount: data.totalAmount,
      billCount: data.bills.length,
      bills: data.bills.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
    }))
    .sort((a, b) => a.periodLabel.localeCompare(b.periodLabel))
}

/**
 * Calculate maximum number of periods to generate
 */
function calculateMaxPeriods(startDate: Date, endDate: Date, frequency: RecurrenceFrequency): number {
  const diffMs = endDate.getTime() - startDate.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  switch (frequency) {
    case RecurrenceFrequency.MONTHLY:
      return Math.ceil(diffDays / 30) + 1
    case RecurrenceFrequency.QUARTERLY:
      return Math.ceil(diffDays / 90) + 1
    case RecurrenceFrequency.BIANNUALLY:
      return Math.ceil(diffDays / 180) + 1
    case RecurrenceFrequency.YEARLY:
      return Math.ceil(diffDays / 365) + 1
    default:
      return 12
  }
}

/**
 * TODO: Analyze historical bills without explicit recurrence to detect patterns
 * This function should:
 * - Group bills by title/vendor/category
 * - Analyze date intervals to detect monthly/quarterly/yearly patterns
 * - Consider variance in amounts and dates
 * - Return detected patterns with confidence scores
 */
export function analyzeHistoricalPatterns(bills: Bill[]): Array<{
  billGroup: Bill[]
  detectedFrequency: RecurrenceFrequency | null
  confidence: number
}> {
  // TODO: Implement historical pattern analysis
  // This should detect if bills follow a pattern even without explicit recurrence
  // Consider:
  // - Bills with same title/vendor/category
  // - Date intervals between bills
  // - Amount consistency
  // - Statistical analysis to determine if pattern exists
  
  return []
}

/**
 * TODO: Detect if bills follow a recurrence pattern (monthly, quarterly, etc.)
 * This function should:
 * - Analyze a group of bills
 * - Determine if they follow a regular pattern
 * - Return the detected frequency and confidence level
 */
export function detectRecurrenceFromHistory(bills: Bill[]): {
  frequency: RecurrenceFrequency | null
  confidence: number
  dayOfMonth?: number
} {
  // TODO: Implement recurrence detection from history
  // This should:
  // - Calculate intervals between bill dates
  // - Determine most common interval
  // - Check if interval matches monthly/quarterly/yearly patterns
  // - Calculate confidence based on consistency
  
  return {
    frequency: null,
    confidence: 0,
  }
}

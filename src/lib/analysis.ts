import { Bill, RecurrencePattern, AnalysisPeriod, PredictedBill, BudgetPredictionPeriodData } from '@/types'
import { RecurrenceFrequency } from '@/generated/prisma/client'
import { getUpcomingDueDates } from './recurrence'
import { format, getQuarter, differenceInDays, getDate } from 'date-fns'
import { enhancePredictionsWithActualData, shouldMatchBill } from './business/recurring-bills'

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
 * Synthesize virtual bills for recurring bills with < 3 data points
 * Creates 2-3 virtual bills at the specified interval to enable calculations
 */
function synthesizeVirtualBills(
  bill: Bill,
  actualBills: Bill[],
  pattern: RecurrencePattern
): Bill[] {
  if (!bill.recurrencePattern) return []

  const matchingBills = actualBills.filter((b) => shouldMatchBill(b, bill))
  
  // Only synthesize if we have < 3 actual bills
  if (matchingBills.length >= 3) return []

  const virtualBills: Bill[] = []
  const billDate = new Date(bill.dueDate)
  const billAmount = Number(bill.amount)

  // Determine interval in days based on frequency
  let intervalDays = 30
  switch (pattern.frequency) {
    case RecurrenceFrequency.MONTHLY:
      intervalDays = 30
      break
    case RecurrenceFrequency.QUARTERLY:
      intervalDays = 90
      break
    case RecurrenceFrequency.BIANNUALLY:
      intervalDays = 180
      break
    case RecurrenceFrequency.YEARLY:
      intervalDays = 365
      break
  }

  // Create 2 virtual bills before and 1 after (or adjust based on what we have)
  const billsNeeded = 3 - matchingBills.length

  // Create virtual bills before the actual bill
  for (let i = 1; i <= Math.ceil(billsNeeded / 2); i++) {
    const virtualDate = new Date(billDate)
    virtualDate.setDate(virtualDate.getDate() - intervalDays * i)
    
    virtualBills.push({
      ...bill,
      id: `virtual-${bill.id}-${i}`,
      dueDate: virtualDate,
      amount: billAmount,
      createdAt: virtualDate,
      updatedAt: virtualDate,
    })
  }

  // Create virtual bills after the actual bill
  for (let i = 1; i <= Math.floor(billsNeeded / 2); i++) {
    const virtualDate = new Date(billDate)
    virtualDate.setDate(virtualDate.getDate() + intervalDays * i)
    
    virtualBills.push({
      ...bill,
      id: `virtual-${bill.id}+${i}`,
      dueDate: virtualDate,
      amount: billAmount,
      createdAt: virtualDate,
      updatedAt: virtualDate,
    })
  }

  return virtualBills
}

/**
 * Generate budget predictions from recurrence patterns
 * Optionally merges with actual bills to replace predictions and enhance future predictions
 * Also includes predictions from detected patterns in historical data
 */
export function generateBudgetPredictions(
  recurringBills: Bill[],
  startDate: Date,
  endDate: Date,
  period: AnalysisPeriod,
  actualBills?: Bill[],
  historicalBills?: Bill[]
): BudgetPredictionPeriodData[] {
  const predictedBills: PredictedBill[] = []
  const allActualBills = actualBills || []
  const allHistoricalBills = historicalBills || []

  // Generate predictions for each recurring bill
  recurringBills.forEach((bill) => {
    if (!bill.recurrencePattern) return

    const pattern = bill.recurrencePattern
    const billStartDate = new Date(pattern.startDate)
    const effectiveStartDate = billStartDate > startDate ? billStartDate : startDate

    // Generate dates up to endDate or pattern endDate, whichever comes first
    const patternEndDate = pattern.endDate ? new Date(pattern.endDate) : endDate
    const effectiveEndDate = patternEndDate < endDate ? patternEndDate : endDate

    // Check if we have < 3 data points and need to synthesize
    const matchingBills = allActualBills.filter((b) => shouldMatchBill(b, bill))
    let billsForCalculation = [...matchingBills]

    if (matchingBills.length < 3) {
      // Synthesize virtual bills for calculation purposes
      const virtualBills = synthesizeVirtualBills(bill, allActualBills, pattern)
      billsForCalculation = [...matchingBills, ...virtualBills]
    }

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
        // If we have < 3 real data points, mark as synthetic
        const isSynthetic = matchingBills.length < 3
        
        predictedBills.push({
          title: bill.title,
          amount: Number(bill.amount),
          dueDate,
          source: 'recurrence',
          billId: bill.id,
          categoryId: bill.categoryId,
          vendorId: bill.vendorId,
          method: isSynthetic ? 'synthetic' : undefined,
          confidence: isSynthetic ? 0.4 : undefined, // Lower confidence for synthetic
        })
      }
    })
  })

  // Detect patterns from historical bills and generate predictions
  if (allHistoricalBills.length > 0) {
    const detectedPatterns = analyzeHistoricalPatterns(allHistoricalBills)

    for (const pattern of detectedPatterns) {
      if (!pattern.detectedFrequency || pattern.billGroup.length < 3) continue

      // Check if this pattern already has explicit recurrence
      const hasExplicitRecurrence = recurringBills.some((rb) => {
        if (!rb.recurrencePattern) return false
        const template = pattern.billGroup[0]
        return shouldMatchBill(rb, template) && rb.recurrencePattern
      })

      // Only use detected patterns if there's no explicit recurrence (priority to explicit)
      if (!hasExplicitRecurrence) {
        const template = pattern.billGroup[0]
        const avgAmount =
          pattern.billGroup.reduce((sum, b) => sum + Number(b.amount), 0) /
          pattern.billGroup.length

        // Generate dates based on detected frequency
        const lastBillDate = new Date(
          Math.max(...pattern.billGroup.map((b) => new Date(b.dueDate).getTime()))
        )
        const dayOfMonth = pattern.dayOfMonth || getDate(lastBillDate)

        const dates = getUpcomingDueDates(
          lastBillDate,
          pattern.detectedFrequency,
          dayOfMonth,
          endDate,
          calculateMaxPeriods(lastBillDate, endDate, pattern.detectedFrequency)
        )

        dates.forEach((dueDate) => {
          if (dueDate >= startDate && dueDate <= endDate) {
            predictedBills.push({
              title: template.title,
              amount: avgAmount,
              dueDate,
              source: 'detected',
              billId: template.id,
              categoryId: template.categoryId,
              vendorId: template.vendorId,
              method: 'average',
              confidence: pattern.confidence,
            })
          }
        })
      }
    }
  }

  // Merge with actual bills if provided
  let finalPredictions = predictedBills
  if (allActualBills.length > 0) {
    finalPredictions = enhancePredictionsWithActualData(
      predictedBills,
      allActualBills,
      recurringBills
    )
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
 * Analyze historical bills without explicit recurrence to detect patterns
 * Groups bills by vendor/category/account and detects recurring patterns
 */
export function analyzeHistoricalPatterns(bills: Bill[]): Array<{
  billGroup: Bill[]
  detectedFrequency: RecurrenceFrequency | null
  confidence: number
  dayOfMonth?: number
}> {
  if (bills.length < 3) {
    return []
  }

  // Group bills by vendor/category/account combination (using shouldMatchBill logic)
  const billGroups = new Map<string, Bill[]>()

  for (const bill of bills) {
    // Create a key based on vendor, category, and account
    const key = `${bill.vendorId || 'null'}-${bill.categoryId}-${bill.vendorAccountId || 'null'}`

    if (!billGroups.has(key)) {
      billGroups.set(key, [])
    }
    billGroups.get(key)!.push(bill)
  }

  const detectedPatterns: Array<{
    billGroup: Bill[]
    detectedFrequency: RecurrenceFrequency | null
    confidence: number
    dayOfMonth?: number
  }> = []

  // Analyze each group
  for (const [key, groupBills] of billGroups.entries()) {
    // Need at least 3 bills to detect a pattern
    if (groupBills.length < 3) {
      continue
    }

    // Use first bill as template for matching
    const template = groupBills[0]

    // Verify all bills in group match the template (same vendor/category/account)
    const matchingBills = groupBills.filter((bill) => shouldMatchBill(bill, template))

    if (matchingBills.length < 3) {
      continue
    }

    // Detect recurrence pattern
    const detection = detectRecurrenceFromHistory(matchingBills)

    // Only include patterns with confidence > 0.6
    if (detection.confidence > 0.6 && detection.frequency) {
      detectedPatterns.push({
        billGroup: matchingBills,
        detectedFrequency: detection.frequency,
        confidence: detection.confidence,
        dayOfMonth: detection.dayOfMonth,
      })
    }
  }

  return detectedPatterns
}

/**
 * Detect if bills follow a recurrence pattern (monthly, quarterly, etc.)
 * Analyzes intervals between bills and calculates confidence based on consistency
 */
export function detectRecurrenceFromHistory(bills: Bill[]): {
  frequency: RecurrenceFrequency | null
  confidence: number
  dayOfMonth?: number
} {
  if (bills.length < 3) {
    return { frequency: null, confidence: 0 }
  }

  // Sort bills by date
  const sortedBills = [...bills].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  )

  // Calculate intervals between consecutive bills (in days)
  const intervals: number[] = []
  for (let i = 1; i < sortedBills.length; i++) {
    const days = differenceInDays(
      new Date(sortedBills[i].dueDate),
      new Date(sortedBills[i - 1].dueDate)
    )
    intervals.push(days)
  }

  // Calculate average interval
  const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length

  // Calculate standard deviation to measure consistency
  const variance =
    intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) /
    intervals.length
  const stdDev = Math.sqrt(variance)

  // Coefficient of variation (lower = more consistent)
  const coefficientOfVariation = avgInterval > 0 ? stdDev / avgInterval : 1

  // Determine frequency based on average interval
  let detectedFrequency: RecurrenceFrequency | null = null
  const tolerance = 0.2 // 20% tolerance for interval matching

  if (avgInterval >= 25 && avgInterval <= 35) {
    // Monthly: 25-35 days
    detectedFrequency = RecurrenceFrequency.MONTHLY
  } else if (avgInterval >= 85 && avgInterval <= 95) {
    // Quarterly: 85-95 days
    detectedFrequency = RecurrenceFrequency.QUARTERLY
  } else if (avgInterval >= 175 && avgInterval <= 185) {
    // Biannually: 175-185 days
    detectedFrequency = RecurrenceFrequency.BIANNUALLY
  } else if (avgInterval >= 360 && avgInterval <= 370) {
    // Yearly: 360-370 days
    detectedFrequency = RecurrenceFrequency.YEARLY
  }

  if (!detectedFrequency) {
    return { frequency: null, confidence: 0 }
  }

  // Calculate confidence based on:
  // 1. Consistency of intervals (lower coefficient of variation = higher confidence)
  // 2. Number of bills (more bills = higher confidence)
  // 3. Amount variance (lower variance = higher confidence)

  // Interval consistency score (0-1, higher is better)
  const consistencyScore = Math.max(0, 1 - coefficientOfVariation)

  // Sample size score (0-1, more samples = higher confidence, caps at 0.8 for 10+ bills)
  const sampleSizeScore = Math.min(0.8, bills.length / 12)

  // Amount variance score
  const amounts = sortedBills.map((b) => Number(b.amount))
  const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length
  const amountVariance =
    amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length
  const amountStdDev = Math.sqrt(amountVariance)
  const amountCoefficientOfVariation = avgAmount > 0 ? amountStdDev / avgAmount : 1
  const amountConsistencyScore = Math.max(0, 1 - Math.min(1, amountCoefficientOfVariation))

  // Combined confidence (weighted average)
  const confidence =
    consistencyScore * 0.5 + sampleSizeScore * 0.3 + amountConsistencyScore * 0.2

  // Detect day of month if monthly
  let dayOfMonth: number | undefined
  if (detectedFrequency === RecurrenceFrequency.MONTHLY) {
    // Use most common day of month
    const days = sortedBills.map((b) => getDate(new Date(b.dueDate)))
    const dayCounts = new Map<number, number>()
    days.forEach((day) => {
      dayCounts.set(day, (dayCounts.get(day) || 0) + 1)
    })
    let maxCount = 0
    let mostCommonDay = 1
    dayCounts.forEach((count, day) => {
      if (count > maxCount) {
        maxCount = count
        mostCommonDay = day
      }
    })
    dayOfMonth = mostCommonDay
  }

  return {
    frequency: detectedFrequency,
    confidence: Math.max(0, Math.min(1, confidence)),
    dayOfMonth,
  }
}

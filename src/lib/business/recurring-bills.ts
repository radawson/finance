import { Bill, PredictedBill, PredictionMethod } from '@/types'
import { differenceInDays, isWithinInterval, getMonth, getDate, isWeekend, previousFriday, nextMonday } from 'date-fns'

/**
 * Determines if a bill matches a recurring bill template
 * Bills match if they have the same vendor, vendor account, and category
 */
export function shouldMatchBill(bill: Bill, template: Bill): boolean {
  // Must have same category
  if (bill.categoryId !== template.categoryId) {
    return false
  }

  // Must have same vendor (both null or same ID)
  if (bill.vendorId !== template.vendorId) {
    return false
  }

  // Must have same vendor account (both null or same ID)
  if (bill.vendorAccountId !== template.vendorAccountId) {
    return false
  }

  return true
}

/**
 * Finds which recurring bill template a given bill matches
 * Returns the template bill if a match is found, null otherwise
 */
export function matchBillToRecurringPattern(bill: Bill, recurringBills: Bill[]): Bill | null {
  // Only consider bills with recurrence patterns as templates
  const templates = recurringBills.filter((b) => b.recurrencePattern)

  for (const template of templates) {
    if (shouldMatchBill(bill, template)) {
      return template
    }
  }

  return null
}

/**
 * Checks if an actual bill's due date matches a predicted date within a tolerance window
 * Uses ±3 days as the matching window
 */
export function isDateMatch(actualDate: Date, predictedDate: Date, toleranceDays: number = 3): boolean {
  const daysDiff = Math.abs(differenceInDays(actualDate, predictedDate))
  return daysDiff <= toleranceDays
}

/**
 * Remove outlier amounts using the 2-standard-deviation rule.
 * Returns bills with amounts within 2 stddev of the mean.
 * If all bills are outliers (< 3 remaining), returns the original set.
 */
export function removeAmountOutliers<T extends { amount: number }>(bills: T[]): T[] {
  if (bills.length < 4) return bills // Need at least 4 to meaningfully detect outliers

  const amounts = bills.map((b) => b.amount)
  const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length
  const variance = amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length
  const stdDev = Math.sqrt(variance)

  if (stdDev === 0) return bills // All amounts identical

  const filtered = bills.filter((b) => Math.abs(b.amount - mean) <= 2 * stdDev)

  // If filtering removed too many, return original set
  return filtered.length >= 3 ? filtered : bills
}

/**
 * Compute the median day-of-month from historical bill due dates.
 * Falls back to the recurrence pattern's dayOfMonth if insufficient data.
 */
export function computeMedianDayOfMonth(bills: Bill[], fallbackDay: number): number {
  if (bills.length === 0) return fallbackDay

  const days = bills.map((b) => getDate(new Date(b.dueDate))).sort((a, b) => a - b)
  const mid = Math.floor(days.length / 2)
  return days.length % 2 === 0 ? Math.round((days[mid - 1] + days[mid]) / 2) : days[mid]
}

/**
 * Adjust a predicted date to a weekday if it falls on a weekend.
 * Uses the historical pattern to decide whether to shift to Friday (before) or Monday (after).
 * If no pattern is detected, defaults to Friday (shift earlier).
 */
export function adjustForWeekend(date: Date, historicalBills?: Bill[]): Date {
  if (!isWeekend(date)) return date

  // Determine historical preference: do bills tend to land before or after weekends?
  if (historicalBills && historicalBills.length >= 3) {
    const weekdayDays = historicalBills.map((b) => new Date(b.dueDate).getDay())
    const fridayCount = weekdayDays.filter((d) => d === 5).length
    const mondayCount = weekdayDays.filter((d) => d === 1).length
    if (mondayCount > fridayCount) {
      return nextMonday(date)
    }
  }

  // Default: shift to Friday (earlier)
  return previousFriday(date)
}

/**
 * Bound a predicted amount to be within +-30% of the last known amount.
 * Prevents runaway regression on volatile bills.
 */
export function boundPredictedAmount(predicted: number, lastKnown: number): number {
  if (lastKnown <= 0) return Math.max(0, predicted)

  const lower = lastKnown * 0.7
  const upper = lastKnown * 1.3
  return Math.max(lower, Math.min(upper, predicted))
}

/**
 * Linear regression analysis for trend detection
 * Returns slope, intercept, and R² confidence score
 */
function linearRegression(
  bills: Array<{ date: Date; amount: number }>
): { slope: number; intercept: number; rSquared: number } {
  const n = bills.length
  if (n < 2) {
    return { slope: 0, intercept: bills[0]?.amount || 0, rSquared: 0 }
  }

  // Convert dates to numeric (days since first bill)
  const firstDate = bills[0].date.getTime()
  const xValues = bills.map((b) => (b.date.getTime() - firstDate) / (1000 * 60 * 60 * 24))
  const yValues = bills.map((b) => b.amount)

  // Calculate means
  const xMean = xValues.reduce((sum, x) => sum + x, 0) / n
  const yMean = yValues.reduce((sum, y) => sum + y, 0) / n

  // Calculate slope and intercept using least squares
  let numerator = 0
  let denominator = 0

  for (let i = 0; i < n; i++) {
    const xDiff = xValues[i] - xMean
    const yDiff = yValues[i] - yMean
    numerator += xDiff * yDiff
    denominator += xDiff * xDiff
  }

  const slope = denominator !== 0 ? numerator / denominator : 0
  const intercept = yMean - slope * xMean

  // Calculate R² (coefficient of determination)
  let ssRes = 0 // Sum of squares of residuals
  let ssTot = 0 // Total sum of squares

  for (let i = 0; i < n; i++) {
    const predicted = slope * xValues[i] + intercept
    const residual = yValues[i] - predicted
    ssRes += residual * residual
    ssTot += (yValues[i] - yMean) * (yValues[i] - yMean)
  }

  const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0

  return { slope, intercept, rSquared: Math.max(0, Math.min(1, rSquared)) }
}

/**
 * Weighted moving average with exponential decay
 * More recent bills are weighted more heavily
 */
function weightedMovingAverage(bills: Array<{ amount: number }>): number {
  if (bills.length === 0) return 0
  if (bills.length === 1) return bills[0].amount

  // Generate weights with exponential decay (most recent = highest weight)
  // For 4 bills: [0.4, 0.3, 0.2, 0.1]
  const weights: number[] = []
  const totalWeight = bills.length * (bills.length + 1) / 2 // Sum of 1+2+3+...+n
  for (let i = 0; i < bills.length; i++) {
    weights.push((bills.length - i) / totalWeight)
  }

  // Calculate weighted average
  let weightedSum = 0
  let weightSum = 0
  for (let i = 0; i < bills.length; i++) {
    weightedSum += bills[i].amount * weights[i]
    weightSum += weights[i]
  }

  return weightSum > 0 ? weightedSum / weightSum : bills[0].amount
}

/**
 * Seasonal average detection
 * Groups bills by month and calculates average for that month across years
 * Note: allHistoricalBills should already be filtered to matching bills (same vendor/category/account)
 */
function seasonalAverage(
  bills: Array<{ date: Date; amount: number }>,
  targetDate: Date,
  allHistoricalBills: Bill[]
): { amount: number; count: number } | null {
  const targetMonth = getMonth(targetDate) // 0-11

  // Find all bills in the same month across all years
  // Note: allHistoricalBills should already be filtered to matching bills by the caller
  const sameMonthBills = allHistoricalBills.filter((bill) => {
    const billMonth = getMonth(new Date(bill.dueDate))
    return billMonth === targetMonth
  })

  if (sameMonthBills.length < 2) {
    return null // Need at least 2 years of data
  }

  // Check if we have bills from at least 2 different years
  const years = new Set(sameMonthBills.map((b) => new Date(b.dueDate).getFullYear()))
  if (years.size < 2) {
    return null
  }

  const total = sameMonthBills.reduce((sum, bill) => sum + Number(bill.amount), 0)
  return {
    amount: total / sameMonthBills.length,
    count: sameMonthBills.length,
  }
}

/**
 * Calculates enhanced amount using intelligent forecasting
 * Uses linear regression for trends, weighted average as fallback, seasonal patterns when available.
 *
 * Improvements over naive approach:
 * - Outlier detection: removes amounts outside 2 stddev before analysis
 * - Amount bounding: caps prediction at +-30% of last known amount
 * - Skipped bill filtering: excludes SKIPPED bills from amount calculations
 * - Improved confidence floors based on data quantity
 */
export function calculateEnhancedAmount(
  actualBills: Bill[],
  baseAmount: number,
  targetDate: Date,
  allHistoricalBills?: Bill[]
): { amount: number; confidence: number; method: PredictionMethod } {
  // Filter out SKIPPED bills — they shouldn't influence amount prediction
  const nonSkippedBills = actualBills.filter((b) => b.status !== 'SKIPPED')

  if (nonSkippedBills.length === 0) {
    // No history: confidence 0.5 (the user explicitly set this amount)
    return { amount: baseAmount, confidence: 0.5, method: 'average' }
  }

  // Sort by due date to analyze trend
  const sortedBills = [...nonSkippedBills].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  )

  const billData = sortedBills.map((b) => ({
    date: new Date(b.dueDate),
    amount: Number(b.amount),
  }))

  // Remove outliers before further analysis
  const cleanBillData = removeAmountOutliers(billData)

  // Track last known amount for bounding
  const lastKnownAmount = cleanBillData[cleanBillData.length - 1].amount

  // If only one actual bill, use its amount
  if (cleanBillData.length === 1) {
    return { amount: cleanBillData[0].amount, confidence: 0.6, method: 'average' }
  }

  // Confidence floors by data quantity
  // 2 bills: min 0.7, 3+: use calculated
  const dataCountFloor = cleanBillData.length >= 3 ? 0.7 : 0.65

  // If we have 3+ bills, try linear regression for trend detection
  if (cleanBillData.length >= 3) {
    const regression = linearRegression(cleanBillData)

    // If trend confidence is high (R² >= 0.7), use linear regression
    if (regression.rSquared >= 0.7) {
      // Predict amount for target date
      const firstDate = cleanBillData[0].date.getTime()
      const targetDays = (targetDate.getTime() - firstDate) / (1000 * 60 * 60 * 24)
      const predictedAmount = regression.slope * targetDays + regression.intercept

      // Ensure predicted amount is positive and bounded
      const amount = boundPredictedAmount(Math.max(0, predictedAmount), lastKnownAmount)

      return {
        amount,
        confidence: Math.max(dataCountFloor, regression.rSquared),
        method: 'trend',
      }
    }
  }

  // If trend confidence is low, check for seasonal patterns
  // Note: allHistoricalBills should already be filtered to matching bills by the caller
  if (allHistoricalBills && allHistoricalBills.length > 0) {
    // Filter out SKIPPED from historical bills too
    const nonSkippedHistorical = allHistoricalBills.filter((b) => b.status !== 'SKIPPED')
    const seasonal = seasonalAverage(cleanBillData, targetDate, nonSkippedHistorical)
    if (seasonal && seasonal.count >= 2) {
      const amount = boundPredictedAmount(seasonal.amount, lastKnownAmount)
      return {
        amount,
        confidence: Math.max(dataCountFloor, 0.65),
        method: 'seasonal',
      }
    }
  }

  // Fallback to weighted moving average
  const weightedAvg = weightedMovingAverage(cleanBillData)
  const boundedAvg = boundPredictedAmount(weightedAvg, lastKnownAmount)
  return {
    amount: boundedAvg,
    confidence: Math.max(dataCountFloor, cleanBillData.length >= 3 ? 0.65 : 0.6),
    method: 'weighted',
  }
}

/**
 * Replaces predictions with actual bills and enhances remaining predictions
 * Actual bills replace predictions where dates match within tolerance
 * Remaining predictions are enhanced using actual bill amounts
 * Historical bills are used for seasonal pattern analysis
 */
export function enhancePredictionsWithActualData(
  predictions: PredictedBill[],
  actualBills: Bill[],
  recurringTemplates: Bill[],
  historicalBills?: Bill[]
): PredictedBill[] {
  const enhanced: PredictedBill[] = []
  const matchedActualBills = new Set<string>() // Track which actual bills we've matched

  // First pass: replace predictions with actual bills where dates match
  for (const prediction of predictions) {
    const predictionDate = new Date(prediction.dueDate)
    let matched = false

    // Find matching template for this prediction
    const template = recurringTemplates.find((t) => t.id === prediction.billId)
    if (!template) {
      // No template found, keep original prediction
      enhanced.push(prediction)
      continue
    }

    // Look for actual bills that match this template and date
    for (const actualBill of actualBills) {
      if (matchedActualBills.has(actualBill.id)) {
        continue // Already matched to another prediction
      }

      if (shouldMatchBill(actualBill, template) && isDateMatch(new Date(actualBill.dueDate), predictionDate)) {
        // Replace prediction with actual bill
        enhanced.push({
          title: actualBill.title,
          amount: Number(actualBill.amount),
          dueDate: new Date(actualBill.dueDate),
          source: 'recurrence', // Keep as recurrence since it's from a recurring pattern
          billId: actualBill.id,
          categoryId: actualBill.categoryId,
          vendorId: actualBill.vendorId,
        })
        matchedActualBills.add(actualBill.id)
        matched = true
        break
      }
    }

    // If no match found, keep the prediction (will be enhanced in next step)
    if (!matched) {
      enhanced.push(prediction)
    }
  }

  // Second pass: enhance remaining predictions using actual bill data
  // Group predictions by template
  const predictionsByTemplate = new Map<string, { predictions: PredictedBill[]; template: Bill }>()

  for (const prediction of enhanced) {
    // Check if this prediction was replaced with an actual bill
    const wasReplaced = matchedActualBills.has(prediction.billId || '')
    
    let template: Bill | undefined
    
    if (wasReplaced) {
      // This was replaced, find template by matching the actual bill to a template
      const actualBill = actualBills.find((b) => b.id === prediction.billId)
      if (actualBill) {
        template = recurringTemplates.find((t) => shouldMatchBill(actualBill, t) && t.recurrencePattern)
      }
    } else {
      // This is still a prediction, find template by billId (which is the template's id)
      template = recurringTemplates.find((t) => t.id === prediction.billId)
    }

    if (!template) {
      // No template found, keep as-is
      continue
    }

    const key = template.id
    if (!predictionsByTemplate.has(key)) {
      predictionsByTemplate.set(key, { predictions: [], template })
    }
    predictionsByTemplate.get(key)!.predictions.push(prediction)
  }

  // Enhance each template's predictions
  const finalPredictions: PredictedBill[] = []

  for (const [templateId, { predictions, template }] of predictionsByTemplate.entries()) {
    // Find all actual bills that match this template
    const matchingActualBills = actualBills.filter((bill) => shouldMatchBill(bill, template))

    // Calculate enhanced amount from actual bills
    const baseAmount = Number(template.amount)

    // Update predictions with enhanced amount
    for (const prediction of predictions) {
      // If this prediction was replaced with an actual bill, keep it as-is
      if (matchedActualBills.has(prediction.billId || '')) {
        // This is an actual bill that replaced a prediction, keep original amount
        finalPredictions.push(prediction)
      } else {
        // This is a future prediction, enhance it with intelligent forecasting
        // Get historical bills that match this template for seasonal analysis
        const matchingHistoricalBills = historicalBills 
          ? historicalBills.filter((b) => shouldMatchBill(b, template))
          : []
        
        // Combine matching actual bills and historical bills for comprehensive analysis
        // Note: These shouldn't overlap since historicalBills are before startDate and actualBills are after
        const allBillsForAnalysis = [...matchingActualBills, ...matchingHistoricalBills]
        
        const forecast = calculateEnhancedAmount(
          matchingActualBills, // Use only recent bills for trend/weighted analysis
          baseAmount,
          new Date(prediction.dueDate),
          allBillsForAnalysis // Pass all matching bills (actual + historical) for seasonal analysis
        )
        finalPredictions.push({
          ...prediction,
          amount: forecast.amount,
          method: forecast.method,
          confidence: forecast.confidence,
        })
      }
    }
  }

  return finalPredictions
}

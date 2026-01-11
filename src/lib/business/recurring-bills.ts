import { Bill, PredictedBill } from '@/types'
import { differenceInDays, isWithinInterval } from 'date-fns'

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
 * Calculates enhanced amount using actual bill data
 * Uses average of actual bills, or detects trend if enough data points exist
 */
export function calculateEnhancedAmount(actualBills: Bill[], baseAmount: number): number {
  if (actualBills.length === 0) {
    return baseAmount
  }

  // Sort by due date to analyze trend
  const sortedBills = [...actualBills].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  )

  // If only one actual bill, use its amount
  if (sortedBills.length === 1) {
    return Number(sortedBills[0].amount)
  }

  // If we have 3+ bills, try to detect a trend
  if (sortedBills.length >= 3) {
    const amounts = sortedBills.map((b) => Number(b.amount))
    const firstHalf = amounts.slice(0, Math.floor(amounts.length / 2))
    const secondHalf = amounts.slice(Math.floor(amounts.length / 2))

    const firstAvg = firstHalf.reduce((sum, a) => sum + a, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((sum, a) => sum + a, 0) / secondHalf.length

    // If there's a clear trend (difference > 5%), use the most recent average
    const trendPercent = Math.abs((secondAvg - firstAvg) / firstAvg) * 100
    if (trendPercent > 5) {
      // Use the most recent bill's amount as it reflects the current trend
      return Number(sortedBills[sortedBills.length - 1].amount)
    }
  }

  // Otherwise, use average of all actual bills
  const total = sortedBills.reduce((sum, bill) => sum + Number(bill.amount), 0)
  return total / sortedBills.length
}

/**
 * Replaces predictions with actual bills and enhances remaining predictions
 * Actual bills replace predictions where dates match within tolerance
 * Remaining predictions are enhanced using actual bill amounts
 */
export function enhancePredictionsWithActualData(
  predictions: PredictedBill[],
  actualBills: Bill[],
  recurringTemplates: Bill[]
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
    const enhancedAmount = calculateEnhancedAmount(matchingActualBills, baseAmount)

    // Update predictions with enhanced amount
    for (const prediction of predictions) {
      // If this prediction was replaced with an actual bill, keep it as-is
      // Otherwise, enhance it with the calculated amount from actual bills
      if (matchedActualBills.has(prediction.billId || '')) {
        // This is an actual bill that replaced a prediction, keep original amount
        finalPredictions.push(prediction)
      } else {
        // This is a future prediction, enhance it with actual bill data
        finalPredictions.push({
          ...prediction,
          amount: enhancedAmount,
        })
      }
    }
  }

  return finalPredictions
}

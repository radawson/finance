import { prisma } from '@/lib/prisma'
import { BillStatus, RecurrenceFrequency } from '@/generated/prisma/client'
import { addDays, isBefore, isAfter } from 'date-fns'
import { getUpcomingDueDates } from '@/lib/recurrence'
import {
  shouldMatchBill,
  isDateMatch,
  calculateEnhancedAmount,
  computeMedianDayOfMonth,
  adjustForWeekend,
  removeAmountOutliers,
} from './recurring-bills'
import { Bill, PredictionMethod } from '@/types'

/**
 * Convert a Prisma bill record into our Bill type,
 * normalizing Decimal and string fields to their TS equivalents.
 */
function normalizeBill(raw: any): Bill {
  return {
    ...raw,
    amount: Number(raw.amount),
    predictionConfidence: raw.predictionConfidence != null ? Number(raw.predictionConfidence) : null,
    predictionMethod: (raw.predictionMethod as PredictionMethod) || null,
    dueDate: new Date(raw.dueDate),
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
    paidDate: raw.paidDate ? new Date(raw.paidDate) : null,
    nextDueDate: raw.nextDueDate ? new Date(raw.nextDueDate) : null,
    recurrencePattern: raw.recurrencePattern
      ? {
          ...raw.recurrencePattern,
          startDate: new Date(raw.recurrencePattern.startDate),
          endDate: raw.recurrencePattern.endDate ? new Date(raw.recurrencePattern.endDate) : null,
          createdAt: new Date(raw.recurrencePattern.createdAt),
          updatedAt: new Date(raw.recurrencePattern.updatedAt),
        }
      : (raw.recurrencePattern ?? undefined),
  } as Bill
}

/**
 * Generate predicted bills for all recurring templates within a 30-day window.
 * This function is idempotent — it will not create duplicate predictions.
 *
 * Steps for each recurring bill template:
 * 1. Compute next due date(s) within the 30-day window
 * 2. Use median day-of-month from history (if available) instead of raw pattern
 * 3. Check for existing predicted or actual bills in the date window (idempotency)
 * 4. Forecast the amount using enhanced analysis (trend/weighted/seasonal)
 * 5. Create a Bill record with status PREDICTED
 *
 * @param userId - The user ID to scope template lookup (null for all users / admin)
 * @param isAdmin - Whether the caller is an admin (sees all bills)
 * @returns Array of predicted Bill records (both new and pre-existing)
 */
export async function generateUpcomingPredictedBills(
  userId: string | null,
  isAdmin: boolean = false,
): Promise<Bill[]> {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const windowEnd = addDays(now, 30)

  // Build where clause for recurring bills
  const recurringWhere: any = {
    isRecurring: true,
    recurrencePattern: { isNot: null },
  }

  if (!isAdmin && userId) {
    recurringWhere.OR = [
      { createdById: userId },
      { createdById: null },
    ]
  }

  // Fetch all recurring bill templates
  const recurringBillsRaw = await prisma.bill.findMany({
    where: recurringWhere,
    include: {
      category: true,
      vendor: true,
      vendorAccount: {
        include: { type: true },
      },
      recurrencePattern: true,
    },
  })

  // Convert Prisma Decimal to number for type compatibility
  const recurringBills: Bill[] = recurringBillsRaw.map(normalizeBill)

  // Fetch historical bills (last 2 years) for forecasting
  const historicalStart = new Date(now)
  historicalStart.setFullYear(historicalStart.getFullYear() - 2)

  const historicalWhere: any = {
    dueDate: { gte: historicalStart, lt: now },
    status: { not: BillStatus.PREDICTED }, // Don't include predictions in history
  }
  if (!isAdmin && userId) {
    historicalWhere.OR = [
      { createdById: userId },
      { createdById: null },
    ]
  }

  const historicalBillsRaw = await prisma.bill.findMany({
    where: historicalWhere,
    include: {
      category: true,
      vendor: true,
      vendorAccount: { include: { type: true } },
    },
  })

  const historicalBills: Bill[] = historicalBillsRaw.map(normalizeBill)

  // Deduplicate recurring bills: group by vendor/account/category, use most recent template
  const deduplicatedTemplates = deduplicateRecurringBills(recurringBills)

  const createdPredictions: Bill[] = []

  for (const template of deduplicatedTemplates) {
    const pattern = template.recurrencePattern
    if (!pattern) continue

    // Check if recurrence has ended
    if (pattern.endDate && isBefore(new Date(pattern.endDate), now)) continue

    // Get matching historical bills for this template
    const matchingHistory = historicalBills.filter((b) => shouldMatchBill(b, template))

    // Use median day-of-month from history if available, else pattern's dayOfMonth
    const effectiveDayOfMonth = matchingHistory.length >= 3
      ? computeMedianDayOfMonth(matchingHistory, pattern.dayOfMonth)
      : pattern.dayOfMonth

    // Calculate due dates within the 30-day window
    // Start from the template's due date or pattern start date
    const patternStart = new Date(pattern.startDate)
    const baseDate = isBefore(patternStart, now) ? now : patternStart
    const patternEnd = pattern.endDate ? new Date(pattern.endDate) : windowEnd
    const effectiveEnd = isBefore(patternEnd, windowEnd) ? patternEnd : windowEnd

    // Calculate max periods
    const maxPeriods = calculateMaxPeriodsForWindow(baseDate, effectiveEnd, pattern.frequency)

    // Generate candidate dates
    // Use the most recent bill's date (or template's dueDate) as the anchor for generating next dates
    const anchor = matchingHistory.length > 0
      ? new Date(Math.max(...matchingHistory.map((b) => new Date(b.dueDate).getTime())))
      : new Date(template.dueDate)

    const candidateDates = getUpcomingDueDates(
      anchor,
      pattern.frequency,
      effectiveDayOfMonth,
      effectiveEnd,
      maxPeriods + 2, // Generate extra in case some fall outside window
    )

    // Filter to only dates within our 30-day window
    const windowDates = candidateDates.filter(
      (d) => (isAfter(d, now) || d.getTime() === now.getTime()) && (isBefore(d, windowEnd) || d.getTime() === windowEnd.getTime()),
    )

    // Forecast amount using enhanced analysis
    const forecast = calculateEnhancedAmount(
      matchingHistory,
      Number(template.amount),
      windowDates[0] || now,
      matchingHistory, // All historical bills for seasonal analysis
    )

    // Create predictions for each due date
    for (const dueDate of windowDates) {
      // Adjust for weekends
      const adjustedDate = adjustForWeekend(dueDate, matchingHistory)

      // Idempotency check: does a bill already exist for this template + date?
      const windowStart = addDays(adjustedDate, -3)
      const windowEndDate = addDays(adjustedDate, 3)

      const existingBill = await prisma.bill.findFirst({
        where: {
          OR: [
            // Match by templateBillId (predicted bills)
            {
              templateBillId: template.id,
              dueDate: { gte: windowStart, lte: windowEndDate },
            },
            // Match by vendor/category/account (actual bills)
            {
              categoryId: template.categoryId,
              vendorId: template.vendorId,
              vendorAccountId: template.vendorAccountId,
              dueDate: { gte: windowStart, lte: windowEndDate },
              status: { not: BillStatus.PREDICTED },
            },
          ],
        },
      })

      if (existingBill) {
        // Already exists — add to results if it's a prediction
        if (existingBill.status === BillStatus.PREDICTED) {
          createdPredictions.push(normalizeBill(existingBill))
        }
        continue
      }

      // Create the predicted bill
      const predictedBill = await prisma.bill.create({
        data: {
          title: template.title,
          description: template.description,
          amount: forecast.amount.toFixed(2),
          dueDate: adjustedDate,
          status: BillStatus.PREDICTED,
          categoryId: template.categoryId,
          vendorId: template.vendorId || null,
          vendorAccountId: template.vendorAccountId || null,
          createdById: template.createdById || null,
          isRecurring: false, // Predicted bills are not themselves recurring
          templateBillId: template.id,
          predictionConfidence: forecast.confidence.toFixed(2),
          predictionMethod: forecast.method,
          tags: template.tags || [],
        },
        include: {
          category: true,
          vendor: true,
          vendorAccount: { include: { type: true } },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      createdPredictions.push(normalizeBill(predictedBill))
    }
  }

  // Also return any existing predicted bills in the window that we didn't just create
  // (e.g., from previous generation runs)
  const existingPredictedWhere: any = {
    status: BillStatus.PREDICTED,
    dueDate: { gte: addDays(now, -7), lte: windowEnd }, // Include recent past (missing bills)
  }
  if (!isAdmin && userId) {
    existingPredictedWhere.OR = [
      { createdById: userId },
      { createdById: null },
    ]
  }

  const allPredictedRaw = await prisma.bill.findMany({
    where: existingPredictedWhere,
    include: {
      category: true,
      vendor: true,
      vendorAccount: { include: { type: true } },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { dueDate: 'asc' },
  })

  const allPredicted: Bill[] = allPredictedRaw.map(normalizeBill)

  return allPredicted
}

/**
 * Deduplicate recurring bills: group by vendor/account/category and keep the most recent template.
 */
function deduplicateRecurringBills(bills: Bill[]): Bill[] {
  const groups = new Map<string, Bill>()

  for (const bill of bills) {
    if (!bill.recurrencePattern) continue

    const key = `${bill.vendorId || 'null'}-${bill.categoryId}-${bill.vendorAccountId || 'null'}`

    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, bill)
    } else {
      // Prefer the one with the more recent due date
      if (new Date(bill.dueDate) > new Date(existing.dueDate)) {
        groups.set(key, bill)
      }
    }
  }

  return Array.from(groups.values())
}

/**
 * Calculate maximum number of periods that fit in a window.
 */
function calculateMaxPeriodsForWindow(
  startDate: Date,
  endDate: Date,
  frequency: RecurrenceFrequency,
): number {
  const diffMs = endDate.getTime() - startDate.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  switch (frequency) {
    case RecurrenceFrequency.MONTHLY:
      return Math.ceil(diffDays / 28) + 1
    case RecurrenceFrequency.QUARTERLY:
      return Math.ceil(diffDays / 85) + 1
    case RecurrenceFrequency.BIANNUALLY:
      return Math.ceil(diffDays / 175) + 1
    case RecurrenceFrequency.YEARLY:
      return Math.ceil(diffDays / 360) + 1
    default:
      return 4
  }
}

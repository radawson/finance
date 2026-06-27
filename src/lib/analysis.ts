import {
  Bill,
  AnalysisPeriod,
  PredictedBill,
  BudgetPredictionPeriodData,
  HistoricBillsPeriodData,
  DecimalValue,
} from '@/types'
import { RecurrenceFrequency } from '@/generated/prisma/client'
import { getUpcomingDueDates } from './recurrence'
import { format, getQuarter } from 'date-fns'
import { shouldMatchBill, estimateRecurringAmount } from './business/recurring-bills'
import { filterExpensesInPeriod } from './business/ledger'
import {
  mergeBillsWithForecast,
  expenseToMergeable,
  predictedBillToMergeable,
  mergeableToPredictedBill,
} from './business/merge-forecast'

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
    const periodLabel = formatPeriodLabel(new Date(bill.dueDate), period)
    const existing = grouped.get(periodLabel)
    if (existing) {
      existing.bills.push(bill)
      existing.totalAmount += Number(bill.amount)
    } else {
      grouped.set(periodLabel, { bills: [bill], totalAmount: Number(bill.amount) })
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

/** Minimal expense shape for ledger-based reporting (accepts Prisma rows). */
type LedgerExpenseInput = {
  id?: string
  date: Date | string
  amount: DecimalValue
  categoryId: string
  vendorId?: string | null
  payee?: string | null
  note?: string | null
  billId?: string | null
  category?: { name?: string | null; color?: string | null } | null
  vendor?: { name?: string | null } | null
}

/**
 * Expense ledger grouped by period — actual spend (groceries + bill payments).
 */
export function generateExpenseLedger(
  expenses: LedgerExpenseInput[],
  startDate: Date,
  endDate: Date,
  period: AnalysisPeriod,
): BudgetPredictionPeriodData[] {
  const inRange = filterExpensesInPeriod(expenses, startDate, endDate)
  const predicted: PredictedBill[] = inRange.map((e) => ({
    title: e.payee || e.category?.name || 'Expense',
    amount: Number(e.amount),
    dueDate: new Date(e.date),
    source: 'actual',
    billId: e.billId ?? undefined,
    categoryId: e.categoryId,
    vendorId: e.vendorId,
  }))
  return groupPredictedBillsByPeriod(predicted, period === 'custom' ? 'monthly' : period)
}

/**
 * Group expenses by period into the historic-spend shape consumed by
 * HistoricBillsView / MarkdownExporter (maps each expense to a bill-like row).
 */
export function groupExpensesByPeriodAsHistoric(
  expenses: LedgerExpenseInput[],
  period: 'monthly' | 'quarterly' | 'yearly',
): HistoricBillsPeriodData[] {
  const billsLike = expenses.map((e) => ({
    ...e,
    title: e.payee || e.category?.name || 'Expense',
    amount: Number(e.amount),
    dueDate: new Date(e.date),
    paidDate: new Date(e.date),
  })) as unknown as Bill[]
  return groupBillsByPeriod(billsLike, period)
}

/**
 * Project recurring obligations forward across [startDate, endDate].
 * Each slot's amount is estimated with the last-paid + seasonal rule
 * (see estimateRecurringAmount). One template per vendor/account/category.
 */
export function forecastObligations(
  recurringBills: Bill[],
  startDate: Date,
  endDate: Date,
  historicalBills: Bill[] = [],
): PredictedBill[] {
  // Deduplicate templates by vendor/account/category (most recent due date wins).
  const templates: Bill[] = []
  const seen = new Set<string>()
  for (const bill of recurringBills) {
    if (!bill.recurrencePattern) continue
    const key = `${bill.vendorId || 'null'}-${bill.categoryId}-${bill.vendorAccountId || 'null'}`
    if (seen.has(key)) {
      const existing = templates.find((b) => shouldMatchBill(bill, b))
      if (existing && new Date(bill.dueDate) > new Date(existing.dueDate)) {
        templates[templates.indexOf(existing)] = bill
      }
      continue
    }
    seen.add(key)
    templates.push(bill)
  }

  const slots: PredictedBill[] = []
  for (const template of templates) {
    const pattern = template.recurrencePattern
    if (!pattern) continue

    const patternStart = new Date(pattern.startDate)
    const effectiveStart = patternStart > startDate ? patternStart : startDate
    const patternEnd = pattern.endDate ? new Date(pattern.endDate) : endDate
    const effectiveEnd = patternEnd < endDate ? patternEnd : endDate

    const maxCount = calculateMaxPeriods(effectiveStart, effectiveEnd, pattern.frequency)
    const dates = getUpcomingDueDates(
      effectiveStart,
      pattern.frequency,
      pattern.dayOfMonth,
      effectiveEnd,
      maxCount,
    )
    const matchingHistory = historicalBills.filter((b) => shouldMatchBill(b, template))

    for (const dueDate of dates) {
      if (dueDate < startDate || dueDate > endDate) continue
      slots.push({
        title: template.title,
        amount: estimateRecurringAmount(template, matchingHistory, dueDate),
        dueDate,
        source: 'recurrence',
        billId: template.id,
        categoryId: template.categoryId,
        vendorId: template.vendorId,
        vendorAccountId: template.vendorAccountId,
      })
    }
  }
  return slots
}

/**
 * Budget overlay: actual ledger spend in range, plus projected obligations for
 * slots not already covered by an actual (actual wins — no double counting).
 */
export function generateBudgetWithForecast(
  recurringBills: Bill[],
  startDate: Date,
  endDate: Date,
  period: AnalysisPeriod,
  actualExpenses: LedgerExpenseInput[],
  historicalBills: Bill[] = [],
): BudgetPredictionPeriodData[] {
  const forecastSlots = forecastObligations(recurringBills, startDate, endDate, historicalBills)
  const actualsInRange = filterExpensesInPeriod(actualExpenses, startDate, endDate)

  const merged = mergeBillsWithForecast(
    actualsInRange.map(expenseToMergeable),
    forecastSlots.map(predictedBillToMergeable),
  )
  const mergedPredicted = merged.map(mergeableToPredictedBill)

  return groupPredictedBillsByPeriod(mergedPredicted, period === 'custom' ? 'monthly' : period)
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
      grouped.set(periodLabel, { bills: [bill], totalAmount: bill.amount })
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

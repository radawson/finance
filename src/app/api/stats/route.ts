import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role } from '@/generated/prisma/client'
import { getBillsDueSoon, getOverdueBills, getUpcomingBills, calculateBillStatus } from '@/lib/bills'
import { getPeriodStartDate, getPeriodEndDate, CategoryPeriod } from '@/lib/date-utils'
import { addDays } from 'date-fns'
import { forecastObligations, generateBudgetWithForecast } from '@/lib/analysis'
import { AnalysisPeriod, Bill, PredictedBill } from '@/types'
import { isActualBill } from '@/lib/business/period-ledger'
import {
  filterExpensesInPeriod,
  categoryBreakdownFromExpenses,
} from '@/lib/business/ledger'
import { categoryBreakdownFromMergeables, predictedBillToMergeable } from '@/lib/business/merge-forecast'
import { isDateMatch, shouldMatchBill } from '@/lib/business/recurring-bills'

function normalizeBillFromPrisma(raw: any): Bill {
  return {
    ...raw,
    amount: Number(raw.amount),
    dueDate: new Date(raw.dueDate),
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
    paidDate: raw.paidDate ? new Date(raw.paidDate) : null,
    nextDueDate: raw.nextDueDate ? new Date(raw.nextDueDate) : null,
    recurrencePattern: raw.recurrencePattern
      ? {
          ...raw.recurrencePattern,
          startDate: new Date(raw.recurrencePattern.startDate),
          endDate: raw.recurrencePattern.endDate
            ? new Date(raw.recurrencePattern.endDate)
            : null,
          createdAt: new Date(raw.recurrencePattern.createdAt),
          updatedAt: new Date(raw.recurrencePattern.updatedAt),
        }
      : null,
  } as Bill
}

function forecastSlotToDashboardBill(slot: PredictedBill, template: Bill): Bill {
  const dueDate = new Date(slot.dueDate)
  return {
    ...template,
    amount: slot.amount,
    dueDate,
    paidDate: null,
    status: calculateBillStatus(dueDate, null),
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const categoryPeriod = (searchParams.get('categoryPeriod') || 'month') as CategoryPeriod
    const includeForecast = searchParams.get('includeForecast') === 'true'

    const where: any = {}

    if (session.user.role !== Role.ADMIN) {
      where.OR = [{ createdById: session.user.id }, { createdById: null }]
    }

    const allBillsRaw = await prisma.bill.findMany({
      where,
      include: {
        category: true,
        vendor: true,
        recurrencePattern: true,
      },
    })

    const allBills = allBillsRaw.map(normalizeBillFromPrisma)
    const actualBillsOnly = allBills.filter(isActualBill)

    const pendingBills = actualBillsOnly.filter((b) => b.status === 'PENDING').length
    const overdueBills = actualBillsOnly.filter((b) => b.status === 'OVERDUE').length
    const paidBills = actualBillsOnly.filter((b) => b.status === 'PAID').length
    const skippedBills = actualBillsOnly.filter((b) => b.status === 'SKIPPED').length

    const upcomingActuals7 = getBillsDueSoon(actualBillsOnly, 7)
    const upcomingBills30 = getUpcomingBills(actualBillsOnly, 30)
    const overdueBillsList = getOverdueBills(actualBillsOnly)
    const recurringTemplates = allBills.filter((b) => b.isRecurring && b.recurrencePattern)

    const now = new Date()
    const today = new Date(now)
    today.setHours(23, 59, 59, 999)
    const periodStartDate = getPeriodStartDate(categoryPeriod, now)
    const periodEndDate = getPeriodEndDate(categoryPeriod, today)

    // Actual spend by category comes from the ledger (expenses), not bills.
    const expenseWhere: any = {}
    if (session.user.role !== Role.ADMIN) {
      expenseWhere.OR = [{ createdById: session.user.id }, { createdById: null }]
    }
    const expensesForBreakdown = await prisma.expense.findMany({
      where: expenseWhere,
      include: { category: true },
    })

    const categoryBreakdown = categoryBreakdownFromExpenses(
      filterExpensesInPeriod(expensesForBreakdown, periodStartDate, today),
    )
    const projectedCategoryBreakdown = categoryBreakdownFromExpenses(
      filterExpensesInPeriod(expensesForBreakdown, periodStartDate, periodEndDate),
    )

    // Budget burn-down: each of the user's envelopes vs this-period spend.
    const spentMap = new Map<string, number>()
    for (const c of categoryBreakdown) spentMap.set(c.categoryId, c.totalAmount)
    const userEnvelopes = await prisma.budgetEnvelope.findMany({
      where: { userId: session.user.id },
      include: { category: true },
    })
    const budgetVsActual = userEnvelopes
      .map((e) => {
        const budget = Number(e.amount)
        const spent = spentMap.get(e.categoryId) ?? 0
        return {
          categoryId: e.categoryId,
          categoryName: e.category?.name ?? 'Unknown',
          color: e.category?.color ?? null,
          budget,
          spent,
          remaining: budget - spent,
        }
      })
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName))

    let forecastCategoryBreakdown:
      | ReturnType<typeof categoryBreakdownFromExpenses>
      | undefined

    if (includeForecast) {
      const analysisPeriodMap: Record<CategoryPeriod, AnalysisPeriod> = {
        week: 'monthly',
        month: 'monthly',
        quarter: 'quarterly',
        year: 'yearly',
      }
      const analysisPeriod = analysisPeriodMap[categoryPeriod]

      const merged = generateBudgetWithForecast(
        recurringTemplates,
        periodStartDate,
        periodEndDate,
        analysisPeriod,
        expensesForBreakdown,
        actualBillsOnly,
      )

      const categoryLookup = new Map<
        string,
        { name: string; color: string | null }
      >()
      for (const bill of allBills) {
        if (bill.category) {
          categoryLookup.set(bill.categoryId, {
            name: bill.category.name,
            color: bill.category.color ?? null,
          })
        }
      }

      const mergedEntries = merged.flatMap((p) =>
        p.bills.map(predictedBillToMergeable),
      )
      forecastCategoryBreakdown = categoryBreakdownFromMergeables(
        mergedEntries,
        categoryLookup,
      )
    }

    const recentBills = actualBillsOnly
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)

    const horizonStart = new Date(now)
    horizonStart.setHours(0, 0, 0, 0)
    const horizonEnd = addDays(horizonStart, 7)
    horizonEnd.setHours(23, 59, 59, 999)
    const templatesById = new Map(recurringTemplates.map((b) => [b.id, b]))
    const forecastUpcoming = forecastObligations(
      recurringTemplates,
      horizonStart,
      horizonEnd,
      actualBillsOnly,
    )
      .map((slot) => {
        const template = slot.billId ? templatesById.get(slot.billId) : undefined
        return template ? forecastSlotToDashboardBill(slot, template) : null
      })
      .filter((b): b is Bill => b != null)

    const upcomingBillsList = [...upcomingActuals7]
    for (const forecastBill of forecastUpcoming) {
      const alreadyListed = upcomingBillsList.some(
        (actual) =>
          shouldMatchBill(actual, forecastBill) &&
          isDateMatch(new Date(actual.dueDate), new Date(forecastBill.dueDate)),
      )
      if (!alreadyListed) upcomingBillsList.push(forecastBill)
    }
    upcomingBillsList.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    const upcomingBillsListTrimmed = upcomingBillsList.slice(0, 10)

    const stats = {
      totalBills: allBills.length,
      pendingBills,
      dueSoonBills: upcomingBillsListTrimmed.length,
      overdueBills,
      paidBills,
      skippedBills,
      upcomingBills: upcomingBillsListTrimmed.length,
      upcomingBills30: upcomingBills30.length,
      hasAnyData:
        allBills.length > 0 ||
        expensesForBreakdown.length > 0 ||
        userEnvelopes.length > 0,
      categoryBreakdown,
      projectedCategoryBreakdown,
      budgetVsActual,
      ...(forecastCategoryBreakdown
        ? { forecastCategoryBreakdown }
        : {}),
      recentBills,
      upcomingBillsList: upcomingBillsListTrimmed,
      overdueBillsList: overdueBillsList
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
        .slice(0, 10),
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Get stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

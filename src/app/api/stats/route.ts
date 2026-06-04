import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BillStatus, Role } from '@/generated/prisma/client'
import { getBillsDueSoon, getOverdueBills, getUpcomingBills } from '@/lib/bills'
import { getPeriodStartDate, getPeriodEndDate, CategoryPeriod } from '@/lib/date-utils'
import { generateBudgetWithForecast } from '@/lib/analysis'
import { AnalysisPeriod, Bill } from '@/types'
import {
  filterActualBillsInPeriod,
  categoryBreakdownFromBills,
  isActualBill,
} from '@/lib/business/period-ledger'
import { categoryBreakdownFromMergeables, predictedBillToMergeable } from '@/lib/business/merge-forecast'

function normalizeBillFromPrisma(raw: any): Bill {
  return {
    ...raw,
    amount: Number(raw.amount),
    predictionConfidence:
      raw.predictionConfidence != null ? Number(raw.predictionConfidence) : null,
    predictionMethod: raw.predictionMethod as Bill['predictionMethod'],
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

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const categoryPeriod = (searchParams.get('categoryPeriod') || 'month') as CategoryPeriod
    const includeForecast = searchParams.get('includeForecast') === 'true'

    const where: any = {
      status: { not: BillStatus.PREDICTED },
    }

    if (session.user.role !== Role.ADMIN) {
      where.OR = [{ createdById: session.user.id }, { createdById: null }]
    }

    const allBillsRaw = await prisma.bill.findMany({
      where,
      include: {
        category: true,
        vendor: true,
      },
    })

    const allBills = allBillsRaw.map(normalizeBillFromPrisma)
    const actualBillsOnly = allBills.filter(isActualBill)

    const predictedWhere: any = {
      status: BillStatus.PREDICTED,
    }
    if (session.user.role !== Role.ADMIN) {
      predictedWhere.OR = [{ createdById: session.user.id }, { createdById: null }]
    }
    const predictedBillsRaw = await prisma.bill.findMany({
      where: predictedWhere,
      include: {
        category: true,
        vendor: true,
        vendorAccount: { include: { type: true } },
      },
      orderBy: { dueDate: 'asc' },
    })

    const predictedBillsCount = predictedBillsRaw.length
    const nowForMissing = new Date()
    nowForMissing.setHours(0, 0, 0, 0)
    const missingBillsCount = predictedBillsRaw.filter(
      (b) => new Date(b.dueDate) < nowForMissing,
    ).length

    const totalBills = actualBillsOnly.length
    const pendingBills = actualBillsOnly.filter((b) => b.status === 'PENDING').length
    const dueSoonBills = actualBillsOnly.filter((b) => b.status === 'DUE_SOON').length
    const overdueBills = actualBillsOnly.filter((b) => b.status === 'OVERDUE').length
    const paidBills = actualBillsOnly.filter((b) => b.status === 'PAID').length
    const skippedBills = actualBillsOnly.filter((b) => b.status === 'SKIPPED').length

    const upcomingBills7 = getBillsDueSoon(actualBillsOnly, 7)
    const upcomingBills30 = getUpcomingBills(actualBillsOnly, 30)
    const overdueBillsList = getOverdueBills(actualBillsOnly)

    const now = new Date()
    const today = new Date(now)
    today.setHours(23, 59, 59, 999)
    const periodStartDate = getPeriodStartDate(categoryPeriod, now)
    const periodEndDate = getPeriodEndDate(categoryPeriod, today)

    const billsForCategoryBreakdown = filterActualBillsInPeriod(
      actualBillsOnly,
      periodStartDate,
      today,
    )
    const categoryBreakdown = categoryBreakdownFromBills(billsForCategoryBreakdown)

    const projectedActuals = filterActualBillsInPeriod(
      actualBillsOnly,
      periodStartDate,
      periodEndDate,
    )
    const projectedCategoryBreakdown = categoryBreakdownFromBills(projectedActuals)

    let forecastCategoryBreakdown:
      | ReturnType<typeof categoryBreakdownFromBills>
      | undefined

    if (includeForecast) {
      const recurringBillsWhere: any = { isRecurring: true }
      if (session.user.role !== Role.ADMIN) {
        recurringBillsWhere.OR = [
          { createdById: session.user.id },
          { createdById: null },
        ]
      }

      const recurringBillsRaw = await prisma.bill.findMany({
        where: recurringBillsWhere,
        include: {
          category: true,
          vendor: true,
          recurrencePattern: true,
        },
      })

      const recurringBills = recurringBillsRaw.map(normalizeBillFromPrisma)

      const analysisPeriodMap: Record<CategoryPeriod, AnalysisPeriod> = {
        week: 'monthly',
        month: 'monthly',
        quarter: 'quarterly',
        year: 'yearly',
      }
      const analysisPeriod = analysisPeriodMap[categoryPeriod]

      const merged = generateBudgetWithForecast(
        recurringBills,
        periodStartDate,
        periodEndDate,
        analysisPeriod,
        actualBillsOnly,
        [],
        { includeAutoDetect: false, useSimpleForecast: true },
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
      for (const bill of recurringBills) {
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

    const upcomingBillsList = upcomingBills7
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 10)

    const stats = {
      totalBills,
      pendingBills,
      dueSoonBills,
      overdueBills,
      paidBills,
      skippedBills,
      predictedBills: predictedBillsCount,
      missingBills: missingBillsCount,
      upcomingBills: upcomingBills7.length,
      upcomingBills30: upcomingBills30.length,
      categoryBreakdown,
      projectedCategoryBreakdown,
      ...(forecastCategoryBreakdown
        ? { forecastCategoryBreakdown }
        : {}),
      recentBills,
      upcomingBillsList,
      overdueBillsList: overdueBillsList
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
        .slice(0, 10),
      predictedBillsList: predictedBillsRaw.slice(0, 20),
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Get stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

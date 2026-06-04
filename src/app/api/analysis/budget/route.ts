import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role, BillStatus } from '@/generated/prisma/client'
import {
  generateBudgetWithForecast,
  generatePeriodLedger,
  groupBillsByPeriod,
} from '@/lib/analysis'
import { AnalysisPeriod, Bill } from '@/types'
import { isActualBill } from '@/lib/business/period-ledger'

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
    const period = (searchParams.get('period') || 'monthly') as AnalysisPeriod
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const includeHistoric = searchParams.get('includeHistoric') === 'true'
    const includeForecast = searchParams.get('includeForecast') === 'true'

    const startDate = startDateParam ? new Date(startDateParam) : new Date()
    const endDate = endDateParam
      ? new Date(endDateParam)
      : (() => {
          const date = new Date()
          date.setFullYear(date.getFullYear() + 1)
          return date
        })()

    const userFilter =
      session.user.role !== Role.ADMIN
        ? { OR: [{ createdById: session.user.id }, { createdById: null }] }
        : {}

    const recurringBillsRaw = await prisma.bill.findMany({
      where: { isRecurring: true, ...userFilter },
      include: {
        category: true,
        vendor: true,
        vendorAccount: { include: { type: true } },
        recurrencePattern: true,
      },
    })

    const recurringBills = recurringBillsRaw.map(normalizeBillFromPrisma)

    const actualBillsRaw = await prisma.bill.findMany({
      where: {
        dueDate: { gte: startDate, lte: endDate },
        status: { not: BillStatus.PREDICTED },
        ...userFilter,
      },
      include: {
        category: true,
        vendor: true,
        vendorAccount: { include: { type: true } },
      },
    })

    const actualBills = actualBillsRaw.map(normalizeBillFromPrisma).filter(isActualBill)

    const historicalStartDate = new Date(startDate)
    historicalStartDate.setFullYear(historicalStartDate.getFullYear() - 2)

    const historicalBillsRaw = await prisma.bill.findMany({
      where: {
        dueDate: { gte: historicalStartDate, lt: startDate },
        status: { not: BillStatus.PREDICTED },
        ...userFilter,
      },
      include: {
        category: true,
        vendor: true,
        vendorAccount: { include: { type: true } },
      },
    })

    const historicalBills = historicalBillsRaw
      .map(normalizeBillFromPrisma)
      .filter(isActualBill)

    const actuals = generatePeriodLedger(actualBills, startDate, endDate, period)

    const predictions = includeForecast
      ? generateBudgetWithForecast(
          recurringBills,
          startDate,
          endDate,
          period,
          actualBills,
          historicalBills,
          { includeAutoDetect: false, useSimpleForecast: true },
        )
      : actuals

    let historicData
    if (includeHistoric) {
      const historicWhere: any = {
        status: BillStatus.PAID,
        paidDate: {
          gte: new Date(startDate.getFullYear() - 1, startDate.getMonth(), startDate.getDate()),
          lte: startDate,
        },
        ...userFilter,
      }

      const historicBillsRaw = await prisma.bill.findMany({
        where: historicWhere,
        include: { category: true, vendor: true },
      })

      const historicBills = historicBillsRaw.map(normalizeBillFromPrisma).filter(isActualBill)
      const periodType = period === 'custom' ? 'monthly' : period
      historicData = groupBillsByPeriod(historicBills, periodType)
    }

    return NextResponse.json({
      period,
      actuals,
      predictions,
      includeForecast,
      historicData,
    })
  } catch (error) {
    console.error('Get analysis budget error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

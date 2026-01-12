import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role, BillStatus } from '@/generated/prisma/client'
import { generateBudgetPredictions, groupBillsByPeriod, analyzeHistoricalPatterns } from '@/lib/analysis'
import { AnalysisPeriod } from '@/types'

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

    // Default date range if not provided
    const startDate = startDateParam ? new Date(startDateParam) : new Date()
    const endDate = endDateParam ? new Date(endDateParam) : (() => {
      const date = new Date()
      date.setFullYear(date.getFullYear() + 1)
      return date
    })()

    // Build where clause for recurring bills
    const where: any = {
      isRecurring: true,
    }

    // Filter by user if not admin
    if (session.user.role !== Role.ADMIN) {
      where.OR = [
        { createdById: session.user.id },
        { createdById: null },
      ]
    }

    // Get recurring bills with their recurrence patterns
    // These are the "templates" that generate predictions
    const recurringBillsRaw = await prisma.bill.findMany({
      where,
      include: {
        category: true,
        vendor: true,
        vendorAccount: {
          include: {
            type: true,
          },
        },
        recurrencePattern: true,
      },
    })

    // Convert Prisma Decimal to number for type compatibility
    const recurringBills = recurringBillsRaw.map((bill) => ({
      ...bill,
      amount: Number(bill.amount),
    }))

    // Fetch actual bills in the date range that might match recurring patterns
    // These will replace predictions and enhance future predictions
    const actualBillsWhere: any = {
      dueDate: {
        gte: startDate,
        lte: endDate,
      },
    }

    // Filter by user if not admin (same logic as recurring bills)
    if (session.user.role !== Role.ADMIN) {
      actualBillsWhere.OR = [
        { createdById: session.user.id },
        { createdById: null },
      ]
    }

    const actualBillsRaw = await prisma.bill.findMany({
      where: actualBillsWhere,
      include: {
        category: true,
        vendor: true,
        vendorAccount: {
          include: {
            type: true,
          },
        },
      },
    })

    // Convert Prisma Decimal to number for type compatibility
    const actualBills = actualBillsRaw.map((bill) => ({
      ...bill,
      amount: Number(bill.amount),
    }))

    // Fetch historical bills (2+ years back) for pattern detection
    // This includes both paid and unpaid bills to detect recurring patterns
    const historicalStartDate = new Date(startDate)
    historicalStartDate.setFullYear(historicalStartDate.getFullYear() - 2)

    const historicalBillsWhere: any = {
      dueDate: {
        gte: historicalStartDate,
        lte: startDate, // Up to but not including the prediction start date
      },
    }

    // Filter by user if not admin (same logic as recurring bills)
    if (session.user.role !== Role.ADMIN) {
      historicalBillsWhere.OR = [
        { createdById: session.user.id },
        { createdById: null },
      ]
    }

    const historicalBillsRaw = await prisma.bill.findMany({
      where: historicalBillsWhere,
      include: {
        category: true,
        vendor: true,
        vendorAccount: {
          include: {
            type: true,
          },
        },
      },
    })

    // Convert Prisma Decimal to number for type compatibility
    const historicalBills = historicalBillsRaw.map((bill) => ({
      ...bill,
      amount: Number(bill.amount),
    }))

    // Generate predictions from recurrence patterns, merge with actual bills, and detect patterns
    // Actual bills will replace predictions for matching dates
    // Remaining predictions will be enhanced using intelligent forecasting
    // Historical bills will be analyzed to detect recurring patterns automatically
    const predictions = generateBudgetPredictions(
      recurringBills,
      startDate,
      endDate,
      period,
      actualBills,
      historicalBills
    )

    let historicData
    if (includeHistoric) {
      // Get historic paid bills for comparison
      const historicWhere: any = {
        status: BillStatus.PAID,
        paidDate: {
          gte: new Date(startDate.getFullYear() - 1, startDate.getMonth(), startDate.getDate()),
          lte: startDate,
        },
      }

      if (session.user.role !== Role.ADMIN) {
        historicWhere.OR = [
          { createdById: session.user.id },
          { createdById: null },
        ]
      }

      const historicBillsRaw = await prisma.bill.findMany({
        where: historicWhere,
        include: {
          category: true,
          vendor: true,
        },
      })

      // Convert Prisma Decimal to number for type compatibility
      const historicBills = historicBillsRaw.map((bill) => ({
        ...bill,
        amount: Number(bill.amount),
      }))

      const periodType = period === 'custom' ? 'monthly' : period
      historicData = groupBillsByPeriod(historicBills, periodType)
    }

    return NextResponse.json({
      period,
      predictions,
      historicData,
    })
  } catch (error) {
    console.error('Get analysis budget error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

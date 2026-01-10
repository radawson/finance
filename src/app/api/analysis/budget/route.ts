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
    const recurringBills = await prisma.bill.findMany({
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

    // Generate predictions from recurrence patterns
    const predictions = generateBudgetPredictions(
      recurringBills,
      startDate,
      endDate,
      period
    )

    // TODO: Add logic to analyze historical bills without explicit recurrence patterns
    // This should use analyzeHistoricalPatterns() to detect patterns and generate additional predictions
    // For now, we only use explicit recurrence patterns

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

      const historicBills = await prisma.bill.findMany({
        where: historicWhere,
        include: {
          category: true,
          vendor: true,
        },
      })

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

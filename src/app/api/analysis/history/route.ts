import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role } from '@/generated/prisma/client'
import { groupExpensesByPeriodAsHistoric } from '@/lib/analysis'
import { AnalysisPeriod } from '@/types'

/**
 * Historic spend from the ledger (Expense): groceries, one-offs, and bill
 * payments. This is the actual money that went out — the historic picture.
 */
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

    // Filter by user if not admin
    const where: any = {}
    if (session.user.role !== Role.ADMIN) {
      where.OR = [{ createdById: session.user.id }, { createdById: null }]
    }

    // Filter by spend date range if provided
    if (startDateParam || endDateParam) {
      where.date = {}
      if (startDateParam) where.date.gte = new Date(startDateParam)
      if (endDateParam) {
        const end = new Date(endDateParam)
        end.setHours(23, 59, 59, 999)
        where.date.lte = end
      }
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: { category: true, vendor: true },
      orderBy: { date: 'desc' },
    })

    const periodType = period === 'custom' ? 'monthly' : period
    const data = groupExpensesByPeriodAsHistoric(expenses, periodType)

    return NextResponse.json({ period, data })
  } catch (error) {
    console.error('Get analysis history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

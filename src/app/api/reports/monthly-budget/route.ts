import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { householdVisibilityWhere } from '@/lib/household-visibility'
import { buildMonthlyBudgetReport, parseTagFilter } from '@/lib/business/reports'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const startDateRaw = searchParams.get('startDate')
    const endDateRaw = searchParams.get('endDate')
    if (!startDateRaw || !endDateRaw) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
    }

    const startDate = new Date(startDateRaw)
    const endDate = new Date(endDateRaw)
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
    }

    const tags = parseTagFilter(searchParams.get('tags'))
    const visibility = householdVisibilityWhere(session)

    const bills = await prisma.bill.findMany({
      where: {
        ...visibility,
        isRecurring: false,
        dueDate: { gte: startDate, lte: endDate },
      },
      include: { category: true, vendor: true },
      orderBy: { dueDate: 'asc' },
    })

    const report = buildMonthlyBudgetReport({
      bills: bills.map((b) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        dueDate: b.dueDate,
        amount: Number(b.amount),
        tags: b.tags,
        isTaxItem: b.isTaxItem,
        isRecurring: b.isRecurring,
        category: b.category,
        vendor: b.vendor,
      })),
      startDate,
      endDate,
      tags,
    })

    return NextResponse.json(report)
  } catch (error) {
    console.error('Monthly budget report error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

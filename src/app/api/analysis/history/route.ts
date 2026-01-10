import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role, BillStatus } from '@/generated/prisma/client'
import { groupBillsByPeriod } from '@/lib/analysis'
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

    // Build where clause
    const where: any = {
      status: BillStatus.PAID,
    }

    // Filter by user if not admin
    if (session.user.role !== Role.ADMIN) {
      where.OR = [
        { createdById: session.user.id },
        { createdById: null },
      ]
    }

    // Filter by date range if provided
    if (startDateParam) {
      where.paidDate = {
        ...where.paidDate,
        gte: new Date(startDateParam),
      }
    }

    if (endDateParam) {
      const endDate = new Date(endDateParam)
      endDate.setHours(23, 59, 59, 999)
      where.paidDate = {
        ...where.paidDate,
        lte: endDate,
      }
    }

    // Get paid bills
    const bills = await prisma.bill.findMany({
      where,
      include: {
        category: true,
        vendor: true,
        vendorAccount: {
          include: {
            type: true,
          },
        },
      },
      orderBy: {
        paidDate: 'desc',
      },
    })

    // Group bills by period (only for non-custom periods)
    let groupedData
    if (period === 'custom') {
      // For custom, just return all bills grouped by a default period (monthly)
      groupedData = groupBillsByPeriod(bills, 'monthly')
    } else {
      groupedData = groupBillsByPeriod(bills, period)
    }

    return NextResponse.json({
      period,
      data: groupedData,
    })
  } catch (error) {
    console.error('Get analysis history error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

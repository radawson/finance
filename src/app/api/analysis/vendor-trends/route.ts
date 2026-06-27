import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role, BillStatus } from '@/generated/prisma/client'
import { groupBillsByPeriod, formatPeriodLabel } from '@/lib/analysis'
import { AnalysisPeriod } from '@/types'

/**
 * Get vendor trend data for selected vendors across a time period
 * Returns spending trends grouped by period for each vendor
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const vendorIdsParam = searchParams.get('vendorIds')
    const period = (searchParams.get('period') || 'monthly') as AnalysisPeriod
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    // Validate vendor IDs
    if (!vendorIdsParam) {
      return NextResponse.json({ error: 'vendorIds parameter is required' }, { status: 400 })
    }

    const vendorIds = vendorIdsParam.split(',').filter((id) => id.trim().length > 0)
    if (vendorIds.length === 0) {
      return NextResponse.json({ error: 'At least one vendor ID is required' }, { status: 400 })
    }

    // Build where clause for bills
    const where: any = {
      vendorId: {
        in: vendorIds,
      },
      status: BillStatus.PAID, // Only show paid bills for trends
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

    // Get bills for selected vendors
    const billsRaw = await prisma.bill.findMany({
      where,
      include: {
        vendor: true,
        category: true,
      },
      orderBy: {
        paidDate: 'asc',
      },
    })

    // Convert Prisma Decimal to number for type compatibility
    const bills = billsRaw.map((bill) => ({
      ...bill,
      amount: Number(bill.amount),
    }))

    // Get vendor information
    const vendors = await prisma.vendor.findMany({
      where: {
        id: {
          in: vendorIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    })

    // Group bills by vendor and period
    const periodType = period === 'custom' ? 'monthly' : period
    const vendorTrends = vendors.map((vendor) => {
      // Filter bills for this vendor
      const vendorBills = bills.filter((bill) => bill.vendorId === vendor.id)

      // Group by period
      const grouped = groupBillsByPeriod(vendorBills, periodType)

      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        periods: grouped.map((g) => ({
          periodLabel: g.periodLabel,
          totalAmount: g.totalAmount,
          billCount: g.billCount,
        })),
      }
    })

    return NextResponse.json({
      period,
      vendors: vendorTrends,
    })
  } catch (error) {
    console.error('Get vendor trends error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

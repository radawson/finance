import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role } from '@/generated/prisma/client'
import { getBillsDueSoon, getOverdueBills, getUpcomingBills } from '@/lib/bills'
import { addDays } from 'date-fns'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Build where clause
    const where: any = {}

    // Filter by user if not admin - show bills assigned to user OR unassigned bills
    if (session.user.role !== Role.ADMIN) {
      where.OR = [
        { createdById: session.user.id },
        { createdById: null }
      ]
    }

    // Get all bills
    const allBills = await prisma.bill.findMany({
      where,
      include: {
        category: true,
        vendor: true,
      },
    })

    // Calculate stats
    const totalBills = allBills.length
    const pendingBills = allBills.filter((b) => b.status === 'PENDING').length
    const dueSoonBills = allBills.filter((b) => b.status === 'DUE_SOON').length
    const overdueBills = allBills.filter((b) => b.status === 'OVERDUE').length
    const paidBills = allBills.filter((b) => b.status === 'PAID').length
    const skippedBills = allBills.filter((b) => b.status === 'SKIPPED').length

    // Get upcoming bills (next 7 and 30 days)
    const upcomingBills7 = getBillsDueSoon(allBills, 7)
    const upcomingBills30 = getUpcomingBills(allBills, 30)
    const overdueBillsList = getOverdueBills(allBills)

    // Category breakdown
    const categoryMap = new Map<string, { name: string; color: string | null; count: number; totalAmount: number }>()

    allBills.forEach((bill) => {
      const categoryId = bill.categoryId
      const categoryName = bill.category.name
      const categoryColor = bill.category.color
      const existing = categoryMap.get(categoryId)

      if (existing) {
        existing.count++
        existing.totalAmount += Number(bill.amount)
      } else {
        categoryMap.set(categoryId, {
          name: categoryName,
          color: categoryColor,
          count: 1,
          totalAmount: Number(bill.amount),
        })
      }
    })

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.name,
      color: data.color,
      count: data.count,
      totalAmount: data.totalAmount,
    }))

    // Recent bills (last 10, ordered by created date)
    const recentBills = allBills
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)

    // Upcoming bills list (next 7 days, sorted by due date)
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
      upcomingBills: upcomingBills7.length,
      upcomingBills30: upcomingBills30.length,
      categoryBreakdown,
      recentBills,
      upcomingBillsList,
      overdueBillsList: overdueBillsList
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
        .slice(0, 10),
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Get stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

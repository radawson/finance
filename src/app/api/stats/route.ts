import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role } from '@/generated/prisma/client'
import { getBillsDueSoon, getOverdueBills, getUpcomingBills } from '@/lib/bills'
import { addDays } from 'date-fns'
import { getPeriodStartDate, getPeriodEndDate, CategoryPeriod } from '@/lib/date-utils'
import { generateBudgetPredictions } from '@/lib/analysis'
import { AnalysisPeriod } from '@/types'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get category period from query params
    const { searchParams } = new URL(req.url)
    const categoryPeriod = (searchParams.get('categoryPeriod') || 'month') as CategoryPeriod

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

    // Category breakdown - filter by period if specified
    const now = new Date()
    const today = new Date(now)
    today.setHours(23, 59, 59, 999) // End of today
    const periodStartDate = getPeriodStartDate(categoryPeriod, now)
    
    // Filter bills for category breakdown based on dueDate within the selected period
    // getPeriodStartDate already returns a normalized date (start of day)
    const billsForCategoryBreakdown = allBills.filter((bill) => {
      const dueDate = new Date(bill.dueDate)
      dueDate.setHours(0, 0, 0, 0) // Normalize to start of day for comparison
      return dueDate >= periodStartDate && dueDate <= today
    })

    const categoryMap = new Map<string, { name: string; color: string | null; count: number; totalAmount: number }>()

    billsForCategoryBreakdown.forEach((bill) => {
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

    // Projected category breakdown - bills and predictions from today to period end
    const periodEndDate = getPeriodEndDate(categoryPeriod, today)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0) // Start of tomorrow
    
    // Get actual future bills (dueDate > today && dueDate <= periodEndDate)
    // Convert Prisma Decimal to number for type compatibility
    const futureBills = allBills
      .filter((bill) => {
        const dueDate = new Date(bill.dueDate)
        return dueDate > today && dueDate <= periodEndDate
      })
      .map((bill) => ({
        ...bill,
        amount: Number(bill.amount),
        dueDate: new Date(bill.dueDate),
        createdAt: new Date(bill.createdAt),
        updatedAt: new Date(bill.updatedAt),
        paidDate: bill.paidDate ? new Date(bill.paidDate) : null,
        nextDueDate: bill.nextDueDate ? new Date(bill.nextDueDate) : null,
      }))

    // Get recurring bills for predictions
    const recurringBillsWhere: any = {
      isRecurring: true,
    }
    if (session.user.role !== Role.ADMIN) {
      recurringBillsWhere.OR = [
        { createdById: session.user.id },
        { createdById: null }
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

    // Convert Prisma Decimal to number for type compatibility
    const recurringBills = recurringBillsRaw.map((bill) => ({
      ...bill,
      amount: Number(bill.amount),
      dueDate: new Date(bill.dueDate),
      createdAt: new Date(bill.createdAt),
      updatedAt: new Date(bill.updatedAt),
      paidDate: bill.paidDate ? new Date(bill.paidDate) : null,
      nextDueDate: bill.nextDueDate ? new Date(bill.nextDueDate) : null,
      recurrencePattern: bill.recurrencePattern ? {
        ...bill.recurrencePattern,
        startDate: new Date(bill.recurrencePattern.startDate),
        endDate: bill.recurrencePattern.endDate ? new Date(bill.recurrencePattern.endDate) : null,
        createdAt: new Date(bill.recurrencePattern.createdAt),
        updatedAt: new Date(bill.recurrencePattern.updatedAt),
      } : null,
    }))

    // Convert CategoryPeriod to AnalysisPeriod for generateBudgetPredictions
    const analysisPeriodMap: Record<CategoryPeriod, AnalysisPeriod> = {
      week: 'monthly', // Use monthly as default for week (predictions work better with monthly grouping)
      month: 'monthly',
      quarter: 'quarterly',
      year: 'yearly',
    }
    const analysisPeriod = analysisPeriodMap[categoryPeriod]

    // Generate predictions for the future period
    const predictions = generateBudgetPredictions(
      recurringBills,
      tomorrow,
      periodEndDate,
      analysisPeriod,
      futureBills, // Pass actual future bills to replace predictions
      [] // No historical bills needed for this projection
    )

    // Flatten predictions into a single array of PredictedBill
    const allPredictedBills = predictions.flatMap((period) => period.bills)

    // Combine actual future bills with predicted bills
    // Convert future bills to a format compatible with predictions for category breakdown
    const projectedBillsForBreakdown = [
      ...futureBills.map((bill) => ({
        categoryId: bill.categoryId,
        categoryName: bill.category.name,
        categoryColor: bill.category.color,
        amount: Number(bill.amount),
      })),
      ...allPredictedBills
        .filter((pred) => pred.categoryId) // Only include predictions with categories
        .map((pred) => {
          // Find the category for this prediction
          const bill = allBills.find((b) => b.id === pred.billId) || 
                      recurringBills.find((b) => b.id === pred.billId)
          return {
            categoryId: pred.categoryId!,
            categoryName: bill?.category?.name || 'Unknown',
            categoryColor: bill?.category?.color || null,
            amount: pred.amount,
          }
        }),
    ]

    // Calculate projected category breakdown
    const projectedCategoryMap = new Map<string, { name: string; color: string | null; count: number; totalAmount: number }>()

    projectedBillsForBreakdown.forEach((bill) => {
      const categoryId = bill.categoryId
      const categoryName = bill.categoryName
      const categoryColor = bill.categoryColor
      const existing = projectedCategoryMap.get(categoryId)

      if (existing) {
        existing.count++
        existing.totalAmount += bill.amount
      } else {
        projectedCategoryMap.set(categoryId, {
          name: categoryName,
          color: categoryColor,
          count: 1,
          totalAmount: bill.amount,
        })
      }
    })

    const projectedCategoryBreakdown = Array.from(projectedCategoryMap.entries()).map(([categoryId, data]) => ({
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
      projectedCategoryBreakdown,
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

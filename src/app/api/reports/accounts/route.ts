import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { householdVisibilityWhere } from '@/lib/household-visibility'
import { buildAccountsReport } from '@/lib/business/reports'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const visibility = householdVisibilityWhere(session)

    const [accounts, bills] = await Promise.all([
      prisma.vendorAccount.findMany({
        where: { isActive: true },
        include: {
          vendor: { select: { name: true } },
          type: { select: { name: true } },
        },
      }),
      prisma.bill.findMany({
        where: {
          ...visibility,
          vendorAccountId: { not: null },
        },
        select: {
          vendorAccountId: true,
          status: true,
          isRecurring: true,
          amount: true,
          paidAmount: true,
          dueDate: true,
          paidDate: true,
          category: { select: { name: true } },
        },
      }),
    ])

    const report = buildAccountsReport({
      accounts,
      bills: bills.map((bill) => ({
        ...bill,
        categoryName: bill.category?.name ?? null,
      })),
    })

    return NextResponse.json(report)
  } catch (error) {
    console.error('Accounts report error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { subMonths } from 'date-fns'

/**
 * GET /api/analysis/credit-card-balances?period=6m
 *
 * Returns balance snapshot history for accounts that have balance data.
 * Filters by accounts whose AccountType name contains "Credit" (case-insensitive),
 * or falls back to any account with balance snapshots.
 *
 * Query params:
 *   - period: '3m' | '6m' | '1y' (default: '6m')
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || '6m'

    // Calculate start date based on period
    const now = new Date()
    let startDate: Date
    switch (period) {
      case '3m':
        startDate = subMonths(now, 3)
        break
      case '1y':
        startDate = subMonths(now, 12)
        break
      case '6m':
      default:
        startDate = subMonths(now, 6)
        break
    }

    // Find accounts with balance snapshots
    // Prefer accounts with a "Credit Card" account type, but include any with snapshots
    const accounts = await prisma.vendorAccount.findMany({
      where: {
        isActive: true,
        balanceSnapshots: {
          some: {
            recordedAt: {
              gte: startDate,
            },
          },
        },
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
        type: {
          select: {
            id: true,
            name: true,
          },
        },
        balanceSnapshots: {
          where: {
            recordedAt: {
              gte: startDate,
            },
          },
          orderBy: {
            recordedAt: 'asc',
          },
        },
      },
    })

    // Format the response
    const result = accounts.map((account) => ({
      accountId: account.id,
      accountLabel: account.nickname || account.type?.name || 'Account',
      vendorName: account.vendor.name,
      accountTypeName: account.type?.name || null,
      currentBalance: account.balance ? account.balance.toString() : null,
      interestRate: account.interestRate ? account.interestRate.toString() : null,
      snapshots: account.balanceSnapshots.map((snapshot) => ({
        date: snapshot.recordedAt.toISOString(),
        balance: snapshot.balance.toString(),
      })),
    }))

    return NextResponse.json({
      period,
      accounts: result,
    })
  } catch (error) {
    console.error('Credit card balances error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

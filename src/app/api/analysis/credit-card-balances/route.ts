import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { subMonths } from 'date-fns'
import { UUID_REGEX } from '@/types'

/**
 * GET /api/analysis/credit-card-balances?period=6m
 *
 * Returns balance snapshot history for credit-card accounts that have balance data.
 * Includes accounts where either the related AccountType name or legacy accountType
 * text contains "credit" (case-insensitive).
 *
 * Query params:
 *   - period: '3m' | '6m' | '1y' (default: '6m')
 *   - accountTypeId: account type UUID (optional)
 *   - accountTypeName: legacy/fallback name filter (optional)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || '6m'
    const accountTypeId = searchParams.get('accountTypeId')
    const accountTypeName = searchParams.get('accountTypeName')

    if (accountTypeId && !UUID_REGEX.test(accountTypeId)) {
      return NextResponse.json({ error: 'Invalid accountTypeId' }, { status: 400 })
    }

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

    const defaultNameFilter = !accountTypeId && !accountTypeName ? 'credit' : undefined
    const accountTypeNameFilter = accountTypeName ?? defaultNameFilter

    const accountTypeFilter = accountTypeId
      ? {
          accountTypeId,
        }
      : accountTypeNameFilter
      ? {
          OR: [
            {
              type: {
                name: {
                  contains: accountTypeNameFilter,
                  mode: 'insensitive' as const,
                },
              },
            },
            {
              accountType: {
                contains: accountTypeNameFilter,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : {}

    // Find category-filtered active accounts with snapshots
    const accounts = await prisma.vendorAccount.findMany({
      where: {
        isActive: true,
        ...accountTypeFilter,
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
      accountTypeId: accountTypeId ?? null,
      accountTypeName: accountTypeNameFilter ?? null,
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

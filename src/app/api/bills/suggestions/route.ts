import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role } from '@/generated/prisma/client'
import { BillTitleSuggestion } from '@/types'
import { normalizeBillTitle } from '@/lib/business/recurring-bills'

const MAX_SUGGESTIONS = 15

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const q = (req.nextUrl.searchParams.get('q') || '').trim()

    const where: any = {}
    if (session.user.role !== Role.ADMIN) {
      where.OR = [{ createdById: session.user.id }, { createdById: null }]
    }
    if (q) {
      where.title = { contains: q, mode: 'insensitive' }
    }

    const bills = await prisma.bill.findMany({
      where,
      select: {
        title: true,
        categoryId: true,
        vendorId: true,
        vendorAccountId: true,
        dueDate: true,
      },
      orderBy: { dueDate: 'desc' },
    })

    const grouped = new Map<string, BillTitleSuggestion>()
    for (const bill of bills) {
      const key = normalizeBillTitle(bill.title)
      const existing = grouped.get(key)
      if (existing) {
        existing.occurrenceCount += 1
        continue
      }
      grouped.set(key, {
        title: bill.title,
        categoryId: bill.categoryId,
        vendorId: bill.vendorId,
        vendorAccountId: bill.vendorAccountId,
        occurrenceCount: 1,
      })
      if (!q && grouped.size >= MAX_SUGGESTIONS) {
        break
      }
    }

    const suggestions = Array.from(grouped.values()).slice(0, MAX_SUGGESTIONS)
    return NextResponse.json(suggestions)
  } catch (error) {
    console.error('Get bill title suggestions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

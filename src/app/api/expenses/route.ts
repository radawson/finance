import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Role } from '@/generated/prisma/client'
import { UUID_REGEX } from '@/types'

// Accept amount as string or number, coerce to string for Decimal precision
const decimalString = z.union([z.string(), z.number()]).transform((v) => String(v))
const positiveDecimalString = decimalString.refine(
  (v) => !isNaN(Number(v)) && Number(v) > 0,
  { message: 'Amount must be a positive number' },
)

const expenseSchema = z.object({
  amount: positiveDecimalString,
  date: z.string().or(z.coerce.date()).optional(),
  categoryId: z.string().regex(UUID_REGEX, 'Invalid category ID'),
  payee: z.string().max(256).optional().nullable(),
  note: z.string().optional().nullable(),
  vendorId: z.string().regex(UUID_REGEX).optional().nullable(),
})

/**
 * GET /api/expenses — list the user's ledger expenses (groceries, one-offs, and
 * the payments of obligations). Optional ?startDate&endDate&categoryId filters.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const categoryId = searchParams.get('categoryId')

    const where: any = {}
    if (session.user.role !== Role.ADMIN) {
      where.OR = [{ createdById: session.user.id }, { createdById: null }]
    }
    if (categoryId) where.categoryId = categoryId
    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate)
      if (endDate) where.date.lte = new Date(endDate)
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: true,
        vendor: true,
        bill: { select: { id: true, title: true } },
      },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(expenses)
  } catch (error) {
    console.error('Get expenses error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/expenses — log a per-trip expense (groceries, fuel, one-offs).
 * Bill-linked expenses are created only via the bill lifecycle, never here.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = expenseSchema.parse(body)

    const category = await prisma.category.findUnique({ where: { id: data.categoryId } })
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    if (data.vendorId) {
      const vendor = await prisma.vendor.findUnique({ where: { id: data.vendorId } })
      if (!vendor) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
      }
    }

    const expense = await prisma.expense.create({
      data: {
        amount: data.amount,
        date: data.date ? new Date(data.date as any) : new Date(),
        categoryId: data.categoryId,
        payee: data.payee ?? null,
        note: data.note ?? null,
        vendorId: data.vendorId ?? null,
        createdById: session.user.id,
      },
      include: { category: true, vendor: true },
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Create expense error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

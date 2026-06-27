import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { UUID_REGEX } from '@/types'

const decimalString = z.union([z.string(), z.number()]).transform((v) => String(v))
const positiveDecimalString = decimalString.refine(
  (v) => !isNaN(Number(v)) && Number(v) > 0,
  { message: 'Amount must be a positive number' },
)

const envelopeSchema = z.object({
  categoryId: z.string().regex(UUID_REGEX, 'Invalid category ID'),
  amount: positiveDecimalString,
  period: z.enum(['WEEKLY', 'MONTHLY', 'YEARLY']).optional(),
})

/** GET /api/budget/envelopes — the signed-in user's budget envelopes. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const envelopes = await prisma.budgetEnvelope.findMany({
      where: { userId: session.user.id },
      include: { category: true },
      orderBy: { category: { name: 'asc' } },
    })

    return NextResponse.json(envelopes)
  } catch (error) {
    console.error('Get envelopes error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/budget/envelopes — upsert the user's envelope for a category
 * (one per user+category). Sending amount sets/updates the target.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = envelopeSchema.parse(await req.json())

    const category = await prisma.category.findUnique({ where: { id: data.categoryId } })
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const envelope = await prisma.budgetEnvelope.upsert({
      where: { userId_categoryId: { userId: session.user.id, categoryId: data.categoryId } },
      create: {
        userId: session.user.id,
        categoryId: data.categoryId,
        amount: data.amount,
        period: data.period ?? 'MONTHLY',
      },
      update: {
        amount: data.amount,
        ...(data.period && { period: data.period }),
      },
      include: { category: true },
    })

    return NextResponse.json(envelope, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Upsert envelope error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

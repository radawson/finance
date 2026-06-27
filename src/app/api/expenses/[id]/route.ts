import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Role } from '@/generated/prisma/client'
import { UUID_REGEX } from '@/types'

const decimalString = z.union([z.string(), z.number()]).transform((v) => String(v))
const positiveDecimalString = decimalString.refine(
  (v) => !isNaN(Number(v)) && Number(v) > 0,
  { message: 'Amount must be a positive number' },
)

const expenseUpdateSchema = z.object({
  amount: positiveDecimalString.optional(),
  date: z.string().or(z.coerce.date()).optional(),
  categoryId: z.string().regex(UUID_REGEX).optional(),
  payee: z.string().max(256).optional().nullable(),
  note: z.string().optional().nullable(),
  vendorId: z.string().regex(UUID_REGEX).optional().nullable(),
})

async function loadOwned(id: string, session: any) {
  const expense = await prisma.expense.findUnique({ where: { id } })
  if (!expense) return { error: NextResponse.json({ error: 'Expense not found' }, { status: 404 }) }
  if (session.user.role !== Role.ADMIN && expense.createdById && expense.createdById !== session.user.id) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  // Bill-linked expenses are the payment of an obligation — edit them via the bill.
  if (expense.billId) {
    return {
      error: NextResponse.json(
        { error: 'This expense is the payment of a bill. Edit it via the bill instead.' },
        { status: 409 },
      ),
    }
  }
  return { expense }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const { expense, error } = await loadOwned(id, session)
    if (error) return error

    const data = expenseUpdateSchema.parse(await req.json())

    const updated = await prisma.expense.update({
      where: { id: expense!.id },
      data: {
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.date !== undefined && { date: new Date(data.date as any) }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.payee !== undefined && { payee: data.payee }),
        ...(data.note !== undefined && { note: data.note }),
        ...(data.vendorId !== undefined && { vendorId: data.vendorId }),
      },
      include: { category: true, vendor: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Update expense error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const { expense, error } = await loadOwned(id, session)
    if (error) return error

    await prisma.expense.delete({ where: { id: expense!.id } })
    return NextResponse.json({ message: 'Expense deleted successfully' })
  } catch (error) {
    console.error('Delete expense error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Role } from '@/generated/prisma/client'
import { calculateNextDueDate, validateRecurrencePattern } from '@/lib/recurrence'

const recurrenceSchema = z.object({
  frequency: z.enum(['MONTHLY', 'QUARTERLY', 'BIANNUALLY', 'YEARLY']),
  dayOfMonth: z.number().int().min(1).max(31),
  startDate: z.string().or(z.coerce.date()),
  endDate: z.string().or(z.coerce.date()).optional().nullable(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if bill exists and user has permission
    const bill = await prisma.bill.findUnique({
      where: { id },
    })

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    // Check authorization
    if (session.user.role !== Role.ADMIN && bill.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if recurrence pattern already exists
    if (bill.recurrencePatternId) {
      return NextResponse.json(
        { error: 'Recurrence pattern already exists for this bill' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const data = recurrenceSchema.parse({
      ...body,
      startDate: body.startDate ? new Date(body.startDate) : bill.dueDate,
      endDate: body.endDate ? new Date(body.endDate) : null,
    })

    // Validate recurrence pattern
    const validation = validateRecurrencePattern(
      data.frequency,
      data.dayOfMonth,
      data.startDate,
      data.endDate
    )

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Calculate next due date
    const nextDueDate = calculateNextDueDate(
      data.startDate,
      data.frequency,
      data.dayOfMonth,
      data.endDate
    )

    // Create recurrence pattern
    const recurrencePattern = await prisma.recurrencePattern.create({
      data: {
        frequency: data.frequency,
        dayOfMonth: data.dayOfMonth,
        startDate: data.startDate,
        endDate: data.endDate,
        billId: id,
      },
    })

    // Update bill
    const updatedBill = await prisma.bill.update({
      where: { id },
      data: {
        isRecurring: true,
        recurrencePatternId: recurrencePattern.id,
        nextDueDate,
      },
      include: {
        recurrencePattern: true,
      },
    })

    return NextResponse.json(updatedBill, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Create recurrence error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if bill exists and user has permission
    const bill = await prisma.bill.findUnique({
      where: { id },
      include: {
        recurrencePattern: true,
      },
    })

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    // Check authorization
    if (session.user.role !== Role.ADMIN && bill.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!bill.recurrencePattern) {
      return NextResponse.json(
        { error: 'Recurrence pattern not found' },
        { status: 404 }
      )
    }

    const body = await req.json()
    const data = recurrenceSchema.partial().parse({
      ...body,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate !== undefined ? (body.endDate ? new Date(body.endDate) : null) : undefined,
    })

    // Use existing values if not provided
    const frequency = data.frequency || bill.recurrencePattern.frequency
    const dayOfMonth = data.dayOfMonth ?? bill.recurrencePattern.dayOfMonth
    const startDate = data.startDate || bill.recurrencePattern.startDate
    const endDate = data.endDate !== undefined ? data.endDate : bill.recurrencePattern.endDate

    // Validate recurrence pattern
    const validation = validateRecurrencePattern(frequency, dayOfMonth, startDate, endDate)

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Calculate next due date
    const nextDueDate = calculateNextDueDate(startDate, frequency, dayOfMonth, endDate)

    // Update recurrence pattern
    const updatedPattern = await prisma.recurrencePattern.update({
      where: { id: bill.recurrencePattern.id },
      data: {
        ...(data.frequency && { frequency: data.frequency }),
        ...(data.dayOfMonth !== undefined && { dayOfMonth: data.dayOfMonth }),
        ...(data.startDate && { startDate: data.startDate }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
      },
    })

    // Update bill's next due date
    const updatedBill = await prisma.bill.update({
      where: { id },
      data: {
        nextDueDate,
      },
      include: {
        recurrencePattern: true,
      },
    })

    return NextResponse.json(updatedBill)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Update recurrence error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if bill exists and user has permission
    const bill = await prisma.bill.findUnique({
      where: { id },
    })

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    // Check authorization
    if (session.user.role !== Role.ADMIN && bill.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!bill.recurrencePatternId) {
      return NextResponse.json(
        { error: 'Recurrence pattern not found' },
        { status: 404 }
      )
    }

    // Delete recurrence pattern (cascade will handle it, but we'll update bill first)
    await prisma.bill.update({
      where: { id },
      data: {
        isRecurring: false,
        nextDueDate: null,
      },
    })

    await prisma.recurrencePattern.delete({
      where: { id: bill.recurrencePatternId },
    })

    return NextResponse.json({ message: 'Recurrence pattern deleted successfully' })
  } catch (error) {
    console.error('Delete recurrence error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

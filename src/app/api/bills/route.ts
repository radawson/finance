import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { calculateBillStatus } from '@/lib/bills'
import { Role } from '@/generated/prisma/client'

const billSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  amount: z.number().positive('Amount must be positive'),
  dueDate: z.string().or(z.coerce.date()),
  categoryId: z.string().uuid('Invalid category ID'),
  description: z.string().optional(),
  vendorId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'DUE_SOON', 'OVERDUE', 'PAID', 'SKIPPED']).optional(),
  paidDate: z.string().optional().nullable(),
  isRecurring: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const categoryId = searchParams.get('categoryId')
    const vendorId = searchParams.get('vendorId')
    const isRecurring = searchParams.get('isRecurring')

    // Build where clause
    const where: any = {}

    // Filter by user if not admin
    if (session.user.role !== Role.ADMIN) {
      where.createdById = session.user.id
    }

    if (status) {
      where.status = status
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (vendorId) {
      where.vendorId = vendorId
    }

    if (isRecurring !== null) {
      where.isRecurring = isRecurring === 'true'
    }

    const bills = await prisma.bill.findMany({
      where,
      include: {
        category: true,
        vendor: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            comments: true,
            attachments: true,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    })

    return NextResponse.json(bills)
  } catch (error) {
    console.error('Get bills error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsedData = billSchema.parse({
      ...body,
      amount: parseFloat(body.amount),
      dueDate: body.dueDate ? new Date(body.dueDate) : new Date(),
    })

    // Ensure dates are Date objects
    const data = {
      ...parsedData,
      dueDate: new Date(parsedData.dueDate as any),
      paidDate: parsedData.paidDate ? new Date(parsedData.paidDate as any) : null,
    }

    // Verify category exists
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Verify vendor exists if provided
    if (data.vendorId) {
      const vendor = await prisma.vendor.findUnique({
        where: { id: data.vendorId },
      })

      if (!vendor) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
      }
    }

    // Calculate status if not provided
    const status = data.status || calculateBillStatus(data.dueDate, data.paidDate)

    // Create bill
    const bill = await prisma.bill.create({
      data: {
        title: data.title,
        description: data.description,
        amount: data.amount,
        dueDate: data.dueDate,
        paidDate: data.paidDate ? new Date(data.paidDate) : null,
        status,
        categoryId: data.categoryId,
        vendorId: data.vendorId,
        createdById: session.user.id,
        isRecurring: data.isRecurring || false,
      },
      include: {
        category: true,
        vendor: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(bill, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Create bill error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

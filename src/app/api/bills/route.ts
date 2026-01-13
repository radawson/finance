import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { calculateBillStatus } from '@/lib/bills'
import { Role } from '@/generated/prisma/client'
import { UUID_REGEX } from '@/types'
import { emitToAll, SocketEvents } from '@/lib/socketio-server'

const billSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  amount: z.number().positive('Amount must be positive'),
  dueDate: z.string().or(z.coerce.date()),
  categoryId: z.string().regex(UUID_REGEX, 'Invalid category ID'),
  description: z.string().optional(),
  vendorId: z.string().regex(UUID_REGEX).optional(),
  vendorAccountId: z.string().regex(UUID_REGEX).optional().nullable(),
  status: z.enum(['PENDING', 'DUE_SOON', 'OVERDUE', 'PAID', 'SKIPPED']).optional(),
  paidDate: z.string().optional().nullable(),
  isRecurring: z.boolean().optional(),
  invoiceNumber: z.string().optional().nullable(),
  tags: z.array(z.string().max(128, 'Tag must be 128 characters or less')).optional(),
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
    const tags = searchParams.get('tags') // Comma-separated list of tags

    // Build where clause
    const where: any = {}

    // Filter by user if not admin - show bills assigned to user OR unassigned bills
    if (session.user.role !== Role.ADMIN) {
      where.OR = [
        { createdById: session.user.id },
        { createdById: null }
      ]
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

    // Filter by tags - bills must contain ALL specified tags
    if (tags) {
      const tagArray = tags.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
      if (tagArray.length > 0) {
        // PostgreSQL array contains operator - all tags must be in the array
        where.tags = {
          hasEvery: tagArray,
        }
      }
    }

    const bills = await prisma.bill.findMany({
      where,
      include: {
        category: true,
        vendor: true,
        vendorAccount: {
          include: {
            type: true,
          },
        },
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

    // Verify vendorAccount exists and belongs to vendor if both provided
    if (data.vendorAccountId) {
      const vendorAccount = await prisma.vendorAccount.findUnique({
        where: { id: data.vendorAccountId },
        include: { vendor: true },
      })

      if (!vendorAccount) {
        return NextResponse.json({ error: 'Vendor account not found' }, { status: 404 })
      }

      // If vendorId is also provided, ensure account belongs to that vendor
      if (data.vendorId && vendorAccount.vendorId !== data.vendorId) {
        return NextResponse.json(
          { error: 'Vendor account does not belong to the specified vendor' },
          { status: 400 }
        )
      }

      // If vendorId not provided but account is, use account's vendor
      if (!data.vendorId) {
        data.vendorId = vendorAccount.vendorId
      }
    }

    // Calculate status if not provided
    const status = data.status || calculateBillStatus(data.dueDate, data.paidDate)

    // Validate and sanitize tags
    const tagsArray = data.tags
      ? data.tags
          .map((tag: string) => tag.trim())
          .filter((tag: string) => tag.length > 0 && tag.length <= 128)
      : []

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
        vendorAccountId: data.vendorAccountId,
        createdById: session.user.id,
        isRecurring: data.isRecurring || false,
        invoiceNumber: data.invoiceNumber || null,
        tags: tagsArray,
      },
      include: {
        category: true,
        vendor: true,
        vendorAccount: {
          include: {
            type: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Emit WebSocket event for silent UI update (to all authenticated users)
    emitToAll(SocketEvents.BILL_CREATED, {
      bill,
      createdBy: {
        id: session.user.id,
        name: session.user.name,
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

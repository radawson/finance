import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { calculateBillStatus } from '@/lib/bills'
import { Role } from '@/generated/prisma/client'

const updateBillSchema = z.object({
  title: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  dueDate: z.string().or(z.coerce.date()).optional(),
  categoryId: z.string().uuid().optional(),
  description: z.string().optional().nullable(),
  vendorId: z.string().uuid().optional().nullable(),
  status: z.enum(['PENDING', 'DUE_SOON', 'OVERDUE', 'PAID', 'SKIPPED']).optional(),
  paidDate: z.string().optional().nullable(),
  isRecurring: z.boolean().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    const bill = await prisma.bill.findUnique({
      where: { id },
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
        recurrencePattern: true,
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        attachments: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        _count: {
          select: {
            comments: true,
            attachments: true,
          },
        },
      },
    })

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    // Check authorization - allow if anonymous or user created it or admin
    if (session?.user) {
      if (session.user.role !== Role.ADMIN && bill.createdById !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (bill.createdById) {
      // Anonymous user trying to access authenticated bill
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(bill)
  } catch (error) {
    console.error('Get bill error:', error)
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
    const existingBill = await prisma.bill.findUnique({
      where: { id },
    })

    if (!existingBill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    // Check authorization
    if (
      session.user.role !== Role.ADMIN &&
      existingBill.createdById !== session.user.id
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const data = updateBillSchema.parse({
      ...body,
      amount: body.amount ? parseFloat(body.amount) : undefined,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    })

    // Verify category exists if updating
    if (data.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId },
      })

      if (!category) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 })
      }
    }

    // Verify vendor exists if updating
    if (data.vendorId !== undefined) {
      if (data.vendorId) {
        const vendor = await prisma.vendor.findUnique({
          where: { id: data.vendorId },
        })

        if (!vendor) {
          return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
        }
      }
    }

    // Calculate status if dueDate changed or status not explicitly set
    let status = data.status
    if (!status && (data.dueDate || data.paidDate !== undefined)) {
      const dueDate = data.dueDate ? new Date(data.dueDate) : existingBill.dueDate
      const paidDate = data.paidDate !== undefined ? (data.paidDate ? new Date(data.paidDate) : null) : existingBill.paidDate
      status = calculateBillStatus(dueDate, paidDate, existingBill.status)
    }

    // Update bill
    const bill = await prisma.bill.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.dueDate && { dueDate: new Date(data.dueDate) }),
        ...(data.categoryId && { categoryId: data.categoryId }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.vendorId !== undefined && { vendorId: data.vendorId }),
        ...(status && { status }),
        ...(data.paidDate !== undefined && {
          paidDate: data.paidDate ? new Date(data.paidDate) : null,
        }),
        ...(data.isRecurring !== undefined && { isRecurring: data.isRecurring }),
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
        recurrencePattern: true,
      },
    })

    return NextResponse.json(bill)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Update bill error:', error)
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

    // Check authorization - only admin or creator can delete
    if (session.user.role !== Role.ADMIN && bill.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.bill.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Bill deleted successfully' })
  } catch (error) {
    console.error('Delete bill error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { calculateBillStatus } from '@/lib/bills'
import { Role } from '@/generated/prisma/client'
import { UUID_REGEX } from '@/types'

const updateBillSchema = z.object({
  title: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  dueDate: z.string().or(z.coerce.date()).optional(),
  categoryId: z.string().regex(UUID_REGEX).optional(),
  description: z.string().optional().nullable(),
  vendorId: z.string().regex(UUID_REGEX).optional().nullable(),
  vendorAccountId: z.string().regex(UUID_REGEX).optional().nullable(),
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

    // Check authorization - allow if anonymous or user created it or bill is unassigned or admin
    if (session?.user) {
      if (session.user.role !== Role.ADMIN) {
        // Allow if user created it OR bill is unassigned (createdById = null)
        if (bill.createdById !== session.user.id && bill.createdById !== null) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
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

    // Check authorization - allow if user created it or bill is unassigned or admin
    if (session.user.role !== Role.ADMIN) {
      // Allow if user created it OR bill is unassigned (createdById = null)
      if (existingBill.createdById !== session.user.id && existingBill.createdById !== null) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
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

    // Verify vendorAccount exists and belongs to vendor if provided
    if (data.vendorAccountId !== undefined) {
      if (data.vendorAccountId) {
        const vendorAccount = await prisma.vendorAccount.findUnique({
          where: { id: data.vendorAccountId },
          include: { vendor: true },
        })

        if (!vendorAccount) {
          return NextResponse.json({ error: 'Vendor account not found' }, { status: 404 })
        }

        // If vendorId is also being updated, ensure account belongs to that vendor
        const targetVendorId = data.vendorId !== undefined ? data.vendorId : existingBill.vendorId
        if (targetVendorId && vendorAccount.vendorId !== targetVendorId) {
          return NextResponse.json(
            { error: 'Vendor account does not belong to the specified vendor' },
            { status: 400 }
          )
        }

        // If vendorId not provided but account is, ensure it matches existing bill's vendor
        if (!targetVendorId && vendorAccount.vendorId !== existingBill.vendorId) {
          return NextResponse.json(
            { error: 'Vendor account does not belong to the bill\'s vendor' },
            { status: 400 }
          )
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
        ...(data.vendorAccountId !== undefined && { vendorAccountId: data.vendorAccountId }),
        ...(status && { status }),
        ...(data.paidDate !== undefined && {
          paidDate: data.paidDate ? new Date(data.paidDate) : null,
        }),
        ...(data.isRecurring !== undefined && { isRecurring: data.isRecurring }),
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

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { calculateBillStatus } from '@/lib/bills'
import { Role } from '@/generated/prisma/client'
import { UUID_REGEX } from '@/types'
import { emitToBill, emitToUser, SocketEvents } from '@/lib/socketio-server'

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
  invoiceNumber: z.string().optional().nullable(),
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

    // Track changes for notifications
    const changedFields: string[] = []
    if (data.title && data.title !== existingBill.title) changedFields.push('title')
    if (data.amount !== undefined && Number(data.amount) !== Number(existingBill.amount)) changedFields.push('amount')
    if (data.dueDate && new Date(data.dueDate).getTime() !== existingBill.dueDate.getTime()) changedFields.push('dueDate')
    if (data.status && data.status !== existingBill.status) changedFields.push('status')
    if (data.description !== undefined && data.description !== existingBill.description) changedFields.push('description')
    if (data.vendorId !== undefined && data.vendorId !== existingBill.vendorId) changedFields.push('vendor')
    if (data.invoiceNumber !== undefined && data.invoiceNumber !== existingBill.invoiceNumber) changedFields.push('invoiceNumber')

    // Check if bill is being assigned (createdById changes from null to a user ID)
    // When an unassigned bill (createdById = null) is edited by an authenticated user,
    // it gets assigned to that user
    const isBeingAssigned = existingBill.createdById === null && session.user.id !== null

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
        ...(data.invoiceNumber !== undefined && { invoiceNumber: data.invoiceNumber }),
        ...(isBeingAssigned && { createdById: session.user.id }),
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

    // Emit WebSocket event for silent UI update (to bill room)
    emitToBill(id, SocketEvents.BILL_UPDATED, {
      bill,
      changedBy: {
        id: session.user.id,
        name: session.user.name,
      },
    })

    // Create notifications if bill was changed by someone other than the owner
    const billOwnerId = bill.createdById
    const changedByDifferentUser = billOwnerId && billOwnerId !== session.user.id

    if (changedByDifferentUser && changedFields.length > 0) {
      // Create notification for bill owner
      const changedFieldsText = changedFields.join(', ')
      const notification = await prisma.notification.create({
        data: {
          userId: billOwnerId,
          type: 'bill_updated',
          title: 'Bill Updated',
          message: `${session.user.name} updated ${changedFieldsText} on bill "${bill.title}"`,
          billId: bill.id,
        },
      })

      // Emit notification to user's room with bill title
      emitToUser(billOwnerId, SocketEvents.NOTIFICATION_NEW, {
        ...notification,
        billTitle: bill.title,
        createdBy: {
          id: session.user.id,
          name: session.user.name,
        },
      })
    }

    // Create notification if bill was assigned
    if (isBeingAssigned && session.user.id) {
      const notification = await prisma.notification.create({
        data: {
          userId: session.user.id,
          type: 'bill_assigned',
          title: 'Bill Assigned',
          message: `Bill "${bill.title}" has been assigned to you`,
          billId: bill.id,
        },
      })

      // Emit notification to user's room with bill title
      emitToUser(session.user.id, SocketEvents.NOTIFICATION_NEW, {
        ...notification,
        billTitle: bill.title,
      })
    }

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

    // Emit WebSocket event for silent UI update (to bill room)
    emitToBill(id, SocketEvents.BILL_DELETED, { id })

    return NextResponse.json({ message: 'Bill deleted successfully' })
  } catch (error) {
    console.error('Delete bill error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

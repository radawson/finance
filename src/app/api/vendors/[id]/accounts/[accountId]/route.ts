import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Role } from '@/generated/prisma/client'

const updateVendorAccountSchema = z.object({
  accountNumber: z.string().min(1).optional(),
  accountTypeId: z.string().optional().nullable(),
  nickname: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

/**
 * PATCH /api/vendors/[id]/accounts/[accountId]
 * Update a vendor account
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; accountId: string }> }
) {
  try {
    const { id, accountId } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if vendor exists and user has permission
    const vendor = await prisma.vendor.findUnique({
      where: { id },
    })

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    // Vendors are global - no vendor ownership check needed
    // Check if account exists and belongs to vendor
    const account = await prisma.vendorAccount.findUnique({
      where: { id: accountId },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    if (account.vendorId !== id) {
      return NextResponse.json(
        { error: 'Account does not belong to this vendor' },
        { status: 400 }
      )
    }

    // Check if account is used in bills created by this user (proxy for ownership)
    // Since VendorAccount doesn't have createdById, we use bill ownership
    const billWithAccount = await prisma.bill.findFirst({
      where: {
        vendorAccountId: accountId,
        createdById: session.user.id,
      },
    })

    if (!billWithAccount && session.user.role !== Role.ADMIN) {
      return NextResponse.json(
        { error: 'Forbidden - you can only edit accounts used in your bills' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const data = updateVendorAccountSchema.parse(body)

    const updatedAccount = await prisma.vendorAccount.update({
      where: { id: accountId },
      data: {
        accountNumber: data.accountNumber,
        accountTypeId: data.accountTypeId !== undefined ? (data.accountTypeId || null) : undefined,
        nickname: data.nickname !== undefined ? (data.nickname || null) : undefined,
        notes: data.notes !== undefined ? (data.notes || null) : undefined,
        isActive: data.isActive,
      },
      include: {
        type: true,
      },
    })

    return NextResponse.json(updatedAccount)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Update vendor account error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/vendors/[id]/accounts/[accountId]
 * Soft delete a vendor account (set isActive=false)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; accountId: string }> }
) {
  try {
    const { id, accountId } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if vendor exists and user has permission
    const vendor = await prisma.vendor.findUnique({
      where: { id },
    })

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    // Vendors are global - no vendor ownership check needed
    // Check if account exists and belongs to vendor
    const account = await prisma.vendorAccount.findUnique({
      where: { id: accountId },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    if (account.vendorId !== id) {
      return NextResponse.json(
        { error: 'Account does not belong to this vendor' },
        { status: 400 }
      )
    }

    // Check if account is used in bills created by this user (proxy for ownership)
    // Since VendorAccount doesn't have createdById, we use bill ownership
    const billWithAccount = await prisma.bill.findFirst({
      where: {
        vendorAccountId: accountId,
        createdById: session.user.id,
      },
    })

    if (!billWithAccount && session.user.role !== Role.ADMIN) {
      return NextResponse.json(
        { error: 'Forbidden - you can only delete accounts used in your bills' },
        { status: 403 }
      )
    }

    // Soft delete - set isActive to false
    const updatedAccount = await prisma.vendorAccount.update({
      where: { id: accountId },
      data: { isActive: false },
    })

    return NextResponse.json({ message: 'Account deleted successfully' })
  } catch (error) {
    console.error('Delete vendor account error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

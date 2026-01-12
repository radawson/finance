import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Role } from '@/generated/prisma/client'

// Helper to transform empty strings to null for optional fields
const optionalUrl = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? null : val),
  z.string().url().nullable().optional()
)

const optionalEmail = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? null : val),
  z.string().email().nullable().optional()
)

const updateVendorSchema = z.object({
  name: z.string().min(1).optional(),
  email: optionalEmail,
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  website: optionalUrl,
  logo: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
})

/**
 * GET /api/vendors/[id]
 * Get a single vendor by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        accounts: {
          where: {
            isActive: true,
          },
          include: {
            type: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        _count: {
          select: {
            bills: true,
          },
        },
      },
    })

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    // Vendors are global - any authenticated user can view any vendor
    // Filter accounts to only show those used in bills created by this user
    // (since VendorAccount doesn't have createdById, we use bill ownership as proxy)
    const userAccountIds = await prisma.bill.findMany({
      where: {
        createdById: session.user.id,
        vendorAccountId: {
          not: null,
        },
      },
      select: {
        vendorAccountId: true,
      },
      distinct: ['vendorAccountId'],
    })
    const accountIds = userAccountIds
      .map((b) => b.vendorAccountId)
      .filter((id): id is string => id !== null)

    // Filter accounts in the response
    const vendorWithFilteredAccounts = {
      ...vendor,
      accounts: vendor.accounts.filter(
        (account) => accountIds.length === 0 || accountIds.includes(account.id)
      ),
    }

    return NextResponse.json(vendorWithFilteredAccounts)
  } catch (error) {
    console.error('Get vendor error:', error)
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

    // Check if vendor exists and user has permission
    const existing = await prisma.vendor.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    // Vendors are global - any authenticated user can edit any vendor
    // No authorization check needed (createdById is kept for audit purposes only)

    const body = await req.json()
    const data = updateVendorSchema.parse(body)

    const vendor = await prisma.vendor.update({
      where: { id },
      data,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(vendor)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Update vendor error:', error)
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

    // Check if vendor exists and user has permission
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            bills: true,
          },
        },
      },
    })

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    // Vendors are global - restrict deletion to admins only for safety
    if (session.user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Forbidden - only admins can delete vendors' }, { status: 403 })
    }

    // Check if vendor is in use
    if (vendor._count.bills > 0) {
      return NextResponse.json(
        { error: 'Cannot delete vendor that is in use' },
        { status: 400 }
      )
    }

    await prisma.vendor.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Vendor deleted successfully' })
  } catch (error) {
    console.error('Delete vendor error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

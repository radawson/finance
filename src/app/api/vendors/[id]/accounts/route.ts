import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Role } from '@/generated/prisma/client'

const vendorAccountSchema = z.object({
  accountNumber: z.string().min(1, 'Account number is required'),
  accountTypeId: z.string().optional().nullable(),
  nickname: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

/**
 * GET /api/vendors/[id]/accounts
 * List all accounts for a vendor
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

    // Check if vendor exists
    const vendor = await prisma.vendor.findUnique({
      where: { id },
    })

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    // Vendors are global - any authenticated user can view vendor accounts
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

    const accounts = await prisma.vendorAccount.findMany({
      where: {
        vendorId: id,
        isActive: true,
        // Only show accounts used in bills by this user
        ...(accountIds.length > 0 ? { id: { in: accountIds } } : { id: { in: [] } }),
      },
      include: {
        type: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(accounts)
  } catch (error) {
    console.error('Get vendor accounts error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/vendors/[id]/accounts
 * Create a new account for a vendor
 */
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

    // Check if vendor exists and user has permission
    const vendor = await prisma.vendor.findUnique({
      where: { id },
    })

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    // Vendors are global - any authenticated user can create accounts for any vendor
    // The account will be implicitly owned by the user through bills that use it
    // (Note: In the future, we may want to add createdById to VendorAccount for explicit ownership)

    const body = await req.json()
    const data = vendorAccountSchema.parse(body)

    const account = await prisma.vendorAccount.create({
      data: {
        accountNumber: data.accountNumber,
        accountTypeId: data.accountTypeId || null,
        nickname: data.nickname || null,
        notes: data.notes || null,
        vendorId: id,
        isActive: data.isActive ?? true,
      },
      include: {
        type: true,
      },
    })

    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Create vendor account error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

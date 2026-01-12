import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/vendors/public
 * Public endpoint to get vendor names (without account numbers or sensitive data)
 * Returns vendors that have been used in bills, including anonymous bills
 * No authentication required
 * Accounts are NOT included - only logged-in users can view accounts via /api/vendors/[id]
 * For a single vendor, use /api/vendors/public/[id]
 */
export async function GET(req: NextRequest) {
  try {
    // Get all vendors that have been used in bills
    // This includes vendors from both authenticated and anonymous bills
    const vendorsWithBills = await prisma.bill.findMany({
      where: {
        vendorId: {
          not: null,
        },
      },
      select: {
        vendorId: true,
      },
      distinct: ['vendorId'],
    })

    const vendorIds = vendorsWithBills
      .map((bill) => bill.vendorId)
      .filter((id): id is string => id !== null)

    if (vendorIds.length === 0) {
      return NextResponse.json([])
    }

    // Fetch vendor details (only basic info, NO accounts)
    const vendors = await prisma.vendor.findMany({
      where: {
        id: {
          in: vendorIds,
        },
      },
      select: {
        id: true,
        name: true,
        // Exclude sensitive information like email, phone, address, accounts, etc.
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json(vendors)
  } catch (error) {
    console.error('Get public vendors error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

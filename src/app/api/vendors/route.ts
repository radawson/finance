import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Helper to transform empty strings to null for optional fields
const optionalUrl = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? null : val),
  z.string().url().nullable().optional()
)

const optionalEmail = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? null : val),
  z.string().email().nullable().optional()
)

const vendorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
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
 * GET /api/vendors
 * Get all vendors with all active accounts
 * Requires authentication
 * Returns all vendors with all active accounts (users need to see all accounts to select them when creating bills)
 * For public access (no accounts), use /api/vendors/public
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Vendors are global - return all vendors with all active accounts
    // Users need to see all accounts to select them when creating bills
    let vendors
    try {
      vendors = await prisma.vendor.findMany({
        // No filter on vendor - all vendors are global
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
        orderBy: {
          name: 'asc',
        },
      })
    } catch (includeError: any) {
      // If accounts relation doesn't exist (Prisma client not regenerated), try without it
      if (includeError?.code === 'P2009' || includeError?.message?.includes('accounts')) {
        console.warn('Accounts relation not found, fetching vendors without accounts. Run: npx prisma generate')
        vendors = await prisma.vendor.findMany({
          // No filter on vendor - all vendors are global
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                bills: true,
              },
            },
          },
          orderBy: {
            name: 'asc',
          },
        })
        // Add empty accounts array to maintain API contract
        vendors = vendors.map(v => ({ ...v, accounts: [] }))
      } else {
        throw includeError
      }
    }

    return NextResponse.json(vendors)
  } catch (error: any) {
    console.error('Get vendors error:', error)
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    })
    
    // Return more detailed error information
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
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
    const data = vendorSchema.parse(body)

    const vendor = await prisma.vendor.create({
      data: {
        ...data,
        createdById: session.user.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(vendor, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Create vendor error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const vendorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  logo: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Try to include accounts, but handle gracefully if relation doesn't exist
    let vendors
    try {
      vendors = await prisma.vendor.findMany({
        where: {
          createdById: session.user.id,
        },
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
          where: {
            createdById: session.user.id,
          },
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

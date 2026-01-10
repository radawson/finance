import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const accountTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountTypes = await prisma.accountType.findMany({
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json(accountTypes)
  } catch (error) {
    console.error('Get account types error:', error)
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
    const data = accountTypeSchema.parse(body)

    // Check if account type with this name already exists
    const existing = await prisma.accountType.findUnique({
      where: { name: data.name },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Account type with this name already exists' },
        { status: 400 }
      )
    }

    const accountType = await prisma.accountType.create({
      data,
    })

    return NextResponse.json(accountType, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Create account type error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

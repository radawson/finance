import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateAccountTypeSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
})

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

    const accountType = await prisma.accountType.findUnique({
      where: { id },
    })

    if (!accountType) {
      return NextResponse.json({ error: 'Account type not found' }, { status: 404 })
    }

    const body = await req.json()
    const data = updateAccountTypeSchema.parse(body)

    // If name is being updated, check for duplicates
    if (data.name && data.name !== accountType.name) {
      const existing = await prisma.accountType.findUnique({
        where: { name: data.name },
      })

      if (existing) {
        return NextResponse.json(
          { error: 'Account type with this name already exists' },
          { status: 400 }
        )
      }
    }

    const updatedAccountType = await prisma.accountType.update({
      where: { id },
      data,
    })

    return NextResponse.json(updatedAccountType)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Update account type error:', error)
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

    const accountType = await prisma.accountType.findUnique({
      where: { id },
      include: {
        accounts: {
          where: {
            isActive: true,
          },
        },
      },
    })

    if (!accountType) {
      return NextResponse.json({ error: 'Account type not found' }, { status: 404 })
    }

    // Check if any accounts are using this type
    if (accountType.accounts.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete account type that is in use. Please remove it from all accounts first.' },
        { status: 400 }
      )
    }

    await prisma.accountType.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Account type deleted successfully' })
  } catch (error) {
    console.error('Delete account type error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

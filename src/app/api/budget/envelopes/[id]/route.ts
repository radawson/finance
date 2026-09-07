import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** DELETE /api/budget/envelopes/[id] — remove the user's envelope. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const envelope = await prisma.budgetEnvelope.findUnique({ where: { id } })
    if (!envelope) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 })
    }
    if (envelope.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.budgetEnvelope.delete({ where: { id } })
    return NextResponse.json({ message: 'Envelope deleted successfully' })
  } catch (error) {
    console.error('Delete envelope error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

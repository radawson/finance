import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Role } from '@/generated/prisma/client'
import { generateUpcomingPredictedBills } from '@/lib/business/prediction-generator'

/**
 * GET /api/bills/predicted
 *
 * Generates (idempotently) and returns predicted bills for the next 30 days.
 * Predicted bills are real Bill records with status=PREDICTED that can be
 * clicked on and updated when the actual bill arrives.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = session.user.role === Role.ADMIN
    const predictedBills = await generateUpcomingPredictedBills(
      session.user.id,
      isAdmin,
    )

    return NextResponse.json(predictedBills)
  } catch (error) {
    console.error('Get predicted bills error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

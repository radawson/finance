import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(['bill_assigned', 'bill_updated', 'bill_comment', 'bill_attachment']),
  title: z.string().min(1),
  message: z.string().min(1),
  billId: z.string().uuid().optional().nullable(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's notifications, unread first, then by date
    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        // Include bill title if billId exists
      },
      orderBy: [
        { read: 'asc' }, // Unread first
        { createdAt: 'desc' }, // Then by date
      ],
      take: 50, // Limit to 50 most recent
    })

    // Fetch bill titles for notifications that have billId
    const notificationsWithBillTitles = await Promise.all(
      notifications.map(async (notification) => {
        if (notification.billId) {
          const bill = await prisma.bill.findUnique({
            where: { id: notification.billId },
            select: { title: true },
          })
          return {
            ...notification,
            billTitle: bill?.title,
          }
        }
        return notification
      })
    )

    return NextResponse.json(notificationsWithBillTitles)
  } catch (error) {
    console.error('Get notifications error:', error)
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

    // Only admins can create notifications manually (for testing)
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const data = createNotificationSchema.parse(body)

    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        billId: data.billId || null,
      },
    })

    return NextResponse.json(notification, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Create notification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

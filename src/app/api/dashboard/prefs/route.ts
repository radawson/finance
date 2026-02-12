import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { WIDGET_IDS } from '@/lib/dashboard-layout'

const validWidgetIds = Object.values(WIDGET_IDS)

const patchSchema = z.object({
  layouts: z.record(z.string(), z.array(z.object({
    i: z.string(),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    minW: z.number().optional(),
    maxW: z.number().optional(),
    minH: z.number().optional(),
    maxH: z.number().optional(),
    static: z.boolean().optional(),
    isDraggable: z.boolean().optional(),
    isResizable: z.boolean().optional(),
    isBounded: z.boolean().optional(),
  }))).optional(),
  visibleWidgetIds: z.array(
    z.string().refine((id) => validWidgetIds.includes(id as any), {
      message: 'Invalid widget ID',
    })
  ).optional(),
})

/**
 * GET /api/dashboard/prefs
 * Returns the user's dashboard preferences (layouts + visible widget IDs).
 * Returns null if no preferences are saved.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prefs = await prisma.userDashboardPrefs.findUnique({
      where: { userId: session.user.id },
    })

    if (!prefs) {
      return NextResponse.json(null)
    }

    return NextResponse.json({
      layouts: prefs.layouts,
      visibleWidgetIds: prefs.visibleWidgetIds,
    })
  } catch (error) {
    console.error('Get dashboard prefs error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/dashboard/prefs
 * Upsert the user's dashboard preferences.
 * Accepts partial updates: { layouts?, visibleWidgetIds? }
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = patchSchema.parse(body)

    // Build the update/create data
    const updateData: Record<string, unknown> = {}
    if (data.layouts !== undefined) {
      updateData.layouts = data.layouts
    }
    if (data.visibleWidgetIds !== undefined) {
      updateData.visibleWidgetIds = data.visibleWidgetIds
    }

    // If nothing to update, return early
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const prefs = await prisma.userDashboardPrefs.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        layouts: data.layouts ?? {},
        visibleWidgetIds: data.visibleWidgetIds ?? [],
      },
      update: updateData,
    })

    return NextResponse.json({
      layouts: prefs.layouts,
      visibleWidgetIds: prefs.visibleWidgetIds,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Update dashboard prefs error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

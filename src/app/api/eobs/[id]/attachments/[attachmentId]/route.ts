import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile, unlink } from 'fs/promises'
import { Role } from '@/generated/prisma/client'
import { canViewHouseholdRecord } from '@/lib/household-visibility'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id, attachmentId } = await params
    const eob = await prisma.eob.findUnique({ where: { id } })
    if (!eob) return NextResponse.json({ error: 'EOB not found' }, { status: 404 })
    if (!canViewHouseholdRecord(session, eob.createdById)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const attachment = await prisma.eobAttachment.findUnique({ where: { id: attachmentId } })
    if (!attachment) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    if (attachment.eobId !== id) {
      return NextResponse.json({ error: 'Attachment does not belong to this EOB' }, { status: 400 })
    }

    const fileBuffer = await readFile(attachment.filePath)
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `attachment; filename="${attachment.fileName}"`,
        'Content-Length': attachment.fileSize.toString(),
      },
    })
  } catch (error) {
    console.error('Download EOB attachment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id, attachmentId } = await params
    const eob = await prisma.eob.findUnique({ where: { id } })
    if (!eob) return NextResponse.json({ error: 'EOB not found' }, { status: 404 })
    if (!canViewHouseholdRecord(session, eob.createdById)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const attachment = await prisma.eobAttachment.findUnique({ where: { id: attachmentId } })
    if (!attachment) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    if (attachment.eobId !== id) {
      return NextResponse.json({ error: 'Attachment does not belong to this EOB' }, { status: 400 })
    }
    if (session.user.role !== Role.ADMIN && attachment.uploadedById !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
      await unlink(attachment.filePath)
    } catch {
      console.warn('EOB file not found during deletion:', attachment.filePath)
    }

    await prisma.eobAttachment.delete({ where: { id: attachmentId } })
    return NextResponse.json({ message: 'Attachment deleted successfully' })
  } catch (error) {
    console.error('Delete EOB attachment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

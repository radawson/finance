import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile, unlink } from 'fs/promises'
import { Role } from '@/generated/prisma/client'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id, attachmentId } = await params

    // Check if attachment exists
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Verify attachment belongs to bill
    if (attachment.billId !== id) {
      return NextResponse.json(
        { error: 'Attachment does not belong to this bill' },
        { status: 400 }
      )
    }

    // Read file
    const fileBuffer = await readFile(attachment.filePath)

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `attachment; filename="${attachment.fileName}"`,
        'Content-Length': attachment.fileSize.toString(),
      },
    })
  } catch (error) {
    console.error('Download attachment error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id, attachmentId } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if attachment exists
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Verify attachment belongs to bill
    if (attachment.billId !== id) {
      return NextResponse.json(
        { error: 'Attachment does not belong to this bill' },
        { status: 400 }
      )
    }

    // Check authorization - only owner or admin can delete
    if (session.user.role !== Role.ADMIN && attachment.uploadedById !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete file from filesystem
    try {
      await unlink(attachment.filePath)
    } catch (error) {
      // File might not exist, continue with database deletion
      console.warn('File not found during deletion:', attachment.filePath)
    }

    // Delete attachment record
    await prisma.attachment.delete({
      where: { id: attachmentId },
    })

    return NextResponse.json({ message: 'Attachment deleted successfully' })
  } catch (error) {
    console.error('Delete attachment error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

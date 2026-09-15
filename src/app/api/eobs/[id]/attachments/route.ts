import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { canViewHouseholdRecord } from '@/lib/household-visibility'

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760')
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const eob = await prisma.eob.findUnique({ where: { id } })
    if (!eob) return NextResponse.json({ error: 'EOB not found' }, { status: 404 })
    if (!canViewHouseholdRecord(session, eob.createdById)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const attachments = await prisma.eobAttachment.findMany({
      where: { eobId: id },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(attachments)
  } catch (error) {
    console.error('Get EOB attachments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const eob = await prisma.eob.findUnique({ where: { id } })
    if (!eob) return NextResponse.json({ error: 'EOB not found' }, { status: 404 })
    if (!canViewHouseholdRecord(session, eob.createdById)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 },
      )
    }

    const eobUploadDir = join(UPLOAD_DIR, 'eobs', id)
    if (!existsSync(eobUploadDir)) {
      await mkdir(eobUploadDir, { recursive: true })
    }

    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${timestamp}_${sanitizedFileName}`
    const filePath = join(eobUploadDir, fileName)
    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    const attachment = await prisma.eobAttachment.create({
      data: {
        fileName: file.name,
        filePath,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        eobId: id,
        uploadedById: session.user.id,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    console.error('Upload EOB attachment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

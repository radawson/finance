import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { UUID_REGEX } from '@/types'
import { householdVisibilityWhere } from '@/lib/household-visibility'
import { eobInclude, serializeEob } from '@/lib/eobs'

const decimalString = z.union([z.string(), z.number()]).transform((v) => String(v))
const nonnegativeDecimalString = decimalString.refine(
  (v) => !isNaN(Number(v)) && Number(v) >= 0,
  { message: 'Value must be a non-negative number' },
)

const procedureSchema = z.object({
  dateOfService: z.string().or(z.coerce.date()),
  procedureCode: z.string().optional().nullable(),
  description: z.string().min(1),
  billedAmount: nonnegativeDecimalString,
  allowedAmount: nonnegativeDecimalString.optional().nullable(),
  insurancePaid: nonnegativeDecimalString,
  patientResponsibility: nonnegativeDecimalString,
})

const eobSchema = z.object({
  payerName: z.string().min(1, 'Payer is required'),
  vendorId: z.string().regex(UUID_REGEX).optional().nullable(),
  providerName: z.string().min(1, 'Provider is required'),
  claimNumber: z.string().optional().nullable(),
  memberId: z.string().optional().nullable(),
  eobDate: z.string().or(z.coerce.date()),
  serviceStart: z.string().or(z.coerce.date()).optional().nullable(),
  serviceEnd: z.string().or(z.coerce.date()).optional().nullable(),
  billedAmount: nonnegativeDecimalString,
  insurancePaid: nonnegativeDecimalString,
  adjustmentAmount: nonnegativeDecimalString.optional(),
  patientResponsibility: nonnegativeDecimalString,
  tags: z.array(z.string().max(128)).optional(),
  isTaxItem: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  procedures: z.array(procedureSchema).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tags = req.nextUrl.searchParams.get('tags')
    const where: any = householdVisibilityWhere(session)
    if (tags) {
      const tagArray = tags.split(',').map((t) => t.trim()).filter(Boolean)
      if (tagArray.length > 0) {
        where.tags = { hasSome: tagArray }
      }
    }

    const eobs = await prisma.eob.findMany({
      where,
      include: eobInclude,
      orderBy: { eobDate: 'desc' },
    })

    return NextResponse.json(eobs.map(serializeEob))
  } catch (error) {
    console.error('Get EOBs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = eobSchema.parse(body)
    const tags = (data.tags || []).map((t) => t.trim()).filter((t) => t.length > 0 && t.length <= 128)
    const procedures = data.procedures || []

    const created = await prisma.eob.create({
      data: {
        payerName: data.payerName,
        vendorId: data.vendorId || null,
        providerName: data.providerName,
        claimNumber: data.claimNumber || null,
        memberId: data.memberId || null,
        eobDate: new Date(data.eobDate as any),
        serviceStart: data.serviceStart ? new Date(data.serviceStart as any) : null,
        serviceEnd: data.serviceEnd ? new Date(data.serviceEnd as any) : null,
        billedAmount: data.billedAmount,
        insurancePaid: data.insurancePaid,
        adjustmentAmount: data.adjustmentAmount || '0',
        patientResponsibility: data.patientResponsibility,
        tags,
        isTaxItem: data.isTaxItem !== false,
        notes: data.notes || null,
        createdById: session.user.id,
        procedures: {
          create: procedures.map((p, index) => ({
            sortOrder: index,
            dateOfService: new Date(p.dateOfService as any),
            procedureCode: p.procedureCode || null,
            description: p.description,
            billedAmount: p.billedAmount,
            allowedAmount: p.allowedAmount || null,
            insurancePaid: p.insurancePaid,
            patientResponsibility: p.patientResponsibility,
          })),
        },
      },
      include: eobInclude,
    })

    return NextResponse.json(serializeEob(created), { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Create EOB error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

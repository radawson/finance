import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { UUID_REGEX } from '@/types'
import { canViewHouseholdRecord } from '@/lib/household-visibility'
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

const eobUpdateSchema = z.object({
  payerName: z.string().min(1).optional(),
  vendorId: z.string().regex(UUID_REGEX).optional().nullable(),
  providerName: z.string().min(1).optional(),
  claimNumber: z.string().optional().nullable(),
  memberId: z.string().optional().nullable(),
  eobDate: z.string().or(z.coerce.date()).optional(),
  serviceStart: z.string().or(z.coerce.date()).optional().nullable(),
  serviceEnd: z.string().or(z.coerce.date()).optional().nullable(),
  billedAmount: nonnegativeDecimalString.optional(),
  insurancePaid: nonnegativeDecimalString.optional(),
  adjustmentAmount: nonnegativeDecimalString.optional(),
  patientResponsibility: nonnegativeDecimalString.optional(),
  tags: z.array(z.string().max(128)).optional(),
  isTaxItem: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  procedures: z.array(procedureSchema).optional(),
})

async function loadOwnedEob(id: string, session: { user: { id: string; role: any } }) {
  const eob = await prisma.eob.findUnique({ where: { id }, include: eobInclude })
  if (!eob) return { error: NextResponse.json({ error: 'EOB not found' }, { status: 404 }) }
  if (!canViewHouseholdRecord(session, eob.createdById)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { eob }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const { eob, error } = await loadOwnedEob(id, session)
    if (error) return error
    return NextResponse.json(serializeEob(eob))
  } catch (error) {
    console.error('Get EOB error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const { eob, error } = await loadOwnedEob(id, session)
    if (error) return error

    const data = eobUpdateSchema.parse(await req.json())
    const tags = data.tags
      ?.map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= 128)

    const updated = await prisma.$transaction(async (tx) => {
      if (data.procedures) {
        await tx.eobProcedure.deleteMany({ where: { eobId: eob!.id } })
        if (data.procedures.length > 0) {
          await tx.eobProcedure.createMany({
            data: data.procedures.map((p, index) => ({
              eobId: eob!.id,
              sortOrder: index,
              dateOfService: new Date(p.dateOfService as any),
              procedureCode: p.procedureCode || null,
              description: p.description,
              billedAmount: p.billedAmount,
              allowedAmount: p.allowedAmount || null,
              insurancePaid: p.insurancePaid,
              patientResponsibility: p.patientResponsibility,
            })),
          })
        }
      }

      return tx.eob.update({
        where: { id: eob!.id },
        data: {
          ...(data.payerName !== undefined && { payerName: data.payerName }),
          ...(data.vendorId !== undefined && { vendorId: data.vendorId }),
          ...(data.providerName !== undefined && { providerName: data.providerName }),
          ...(data.claimNumber !== undefined && { claimNumber: data.claimNumber }),
          ...(data.memberId !== undefined && { memberId: data.memberId }),
          ...(data.eobDate !== undefined && { eobDate: new Date(data.eobDate as any) }),
          ...(data.serviceStart !== undefined && {
            serviceStart: data.serviceStart ? new Date(data.serviceStart as any) : null,
          }),
          ...(data.serviceEnd !== undefined && {
            serviceEnd: data.serviceEnd ? new Date(data.serviceEnd as any) : null,
          }),
          ...(data.billedAmount !== undefined && { billedAmount: data.billedAmount }),
          ...(data.insurancePaid !== undefined && { insurancePaid: data.insurancePaid }),
          ...(data.adjustmentAmount !== undefined && { adjustmentAmount: data.adjustmentAmount }),
          ...(data.patientResponsibility !== undefined && {
            patientResponsibility: data.patientResponsibility,
          }),
          ...(tags !== undefined && { tags }),
          ...(data.isTaxItem !== undefined && { isTaxItem: data.isTaxItem }),
          ...(data.notes !== undefined && { notes: data.notes }),
        },
        include: eobInclude,
      })
    })

    return NextResponse.json(serializeEob(updated))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Update EOB error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const { eob, error } = await loadOwnedEob(id, session)
    if (error) return error

    await prisma.eob.delete({ where: { id: eob!.id } })
    return NextResponse.json({ message: 'EOB deleted successfully' })
  } catch (error) {
    console.error('Delete EOB error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

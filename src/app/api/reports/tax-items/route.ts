import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { householdVisibilityWhere } from '@/lib/household-visibility'
import { buildTaxItemsReport, parseTagFilter } from '@/lib/business/reports'
import { parseCalendarDateEnd, parseCalendarDateStart } from '@/lib/date-utils'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const startDateRaw = searchParams.get('startDate')
    const endDateRaw = searchParams.get('endDate')
    if (!startDateRaw || !endDateRaw) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
    }

    const startDate = parseCalendarDateStart(startDateRaw)
    const endDate = parseCalendarDateEnd(endDateRaw)
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
    }

    const tags = parseTagFilter(searchParams.get('tags'))
    const visibility = householdVisibilityWhere(session)

    const [bills, eobs, expenses] = await Promise.all([
      prisma.bill.findMany({
        where: {
          ...visibility,
          isTaxItem: true,
          dueDate: { gte: startDate, lte: endDate },
        },
        include: { category: true },
      }),
      prisma.eob.findMany({
        where: {
          ...visibility,
          isTaxItem: true,
          eobDate: { gte: startDate, lte: endDate },
        },
      }),
      prisma.expense.findMany({
        where: {
          ...visibility,
          isTaxItem: true,
          billId: null,
          date: { gte: startDate, lte: endDate },
        },
        include: { category: true },
      }),
    ])

    const report = buildTaxItemsReport({
      bills: bills.map((b) => ({
        id: b.id,
        title: b.title,
        dueDate: b.dueDate,
        amount: Number(b.amount),
        tags: b.tags,
        isTaxItem: b.isTaxItem,
        category: b.category,
      })),
      eobs: eobs.map((e) => ({
        id: e.id,
        eobDate: e.eobDate,
        serviceStart: e.serviceStart,
        serviceEnd: e.serviceEnd,
        providerName: e.providerName,
        payerName: e.payerName,
        tags: e.tags,
        isTaxItem: e.isTaxItem,
        billedAmount: Number(e.billedAmount),
        insurancePaid: Number(e.insurancePaid),
        patientResponsibility: Number(e.patientResponsibility),
      })),
      expenses: expenses.map((e) => ({
        id: e.id,
        date: e.date,
        amount: Number(e.amount),
        payee: e.payee,
        note: e.note,
        billId: e.billId,
        isTaxItem: e.isTaxItem,
        category: e.category,
      })),
      startDate,
      endDate,
      tags,
    })

    return NextResponse.json(report)
  } catch (error) {
    console.error('Tax items report error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

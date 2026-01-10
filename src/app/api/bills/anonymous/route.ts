import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { calculateBillStatus } from '@/lib/bills'
import { UUID_REGEX } from '@/types'

const anonymousBillSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  amount: z.number().positive('Amount must be positive'),
  dueDate: z.string().or(z.coerce.date()),
  categoryId: z.string().regex(UUID_REGEX, 'Invalid category ID'),
  description: z.string().optional(),
  vendorId: z.string().regex(UUID_REGEX).optional(),
  vendorAccountId: z.string().regex(UUID_REGEX).optional().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsedData = anonymousBillSchema.parse({
      ...body,
      amount: parseFloat(body.amount),
      dueDate: body.dueDate ? new Date(body.dueDate) : new Date(),
    })

    // Ensure dueDate is a Date object
    const data = {
      ...parsedData,
      dueDate: parsedData.dueDate instanceof Date ? parsedData.dueDate : new Date(parsedData.dueDate),
    }

    // Verify category exists
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Verify vendor exists if provided
    if (data.vendorId) {
      const vendor = await prisma.vendor.findUnique({
        where: { id: data.vendorId },
      })

      if (!vendor) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
      }
    }

    // Verify vendorAccount exists and belongs to vendor if both provided
    if (data.vendorAccountId) {
      const vendorAccount = await prisma.vendorAccount.findUnique({
        where: { id: data.vendorAccountId },
        include: { vendor: true },
      })

      if (!vendorAccount) {
        return NextResponse.json({ error: 'Vendor account not found' }, { status: 404 })
      }

      // If vendorId is also provided, ensure account belongs to that vendor
      if (data.vendorId && vendorAccount.vendorId !== data.vendorId) {
        return NextResponse.json(
          { error: 'Vendor account does not belong to the specified vendor' },
          { status: 400 }
        )
      }

      // If vendorId not provided but account is, use account's vendor
      if (!data.vendorId) {
        data.vendorId = vendorAccount.vendorId
      }
    }

    // Calculate status based on due date
    const status = calculateBillStatus(data.dueDate)

    // Create bill
    const bill = await prisma.bill.create({
      data: {
        title: data.title,
        description: data.description,
        amount: data.amount,
        dueDate: data.dueDate,
        status,
        categoryId: data.categoryId,
        vendorId: data.vendorId,
        vendorAccountId: data.vendorAccountId,
        createdById: null, // Anonymous entry
        isRecurring: false,
      },
      include: {
        category: true,
        vendor: true,
        vendorAccount: true,
      },
    })

    return NextResponse.json(bill, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Anonymous bill creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

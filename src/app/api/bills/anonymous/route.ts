import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { calculateBillStatus } from '@/lib/bills'

const anonymousBillSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  amount: z.number().positive('Amount must be positive'),
  dueDate: z.string().or(z.coerce.date()),
  categoryId: z.string().uuid('Invalid category ID'),
  description: z.string().optional(),
  vendorId: z.string().uuid().optional(),
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
        createdById: null, // Anonymous entry
        isRecurring: false,
      },
      include: {
        category: true,
        vendor: true,
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

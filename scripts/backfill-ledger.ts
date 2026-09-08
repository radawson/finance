/**
 * Idempotent ledger backfill for existing databases.
 *
 *   npx tsx scripts/backfill-ledger.ts --dry-run
 *   npx tsx scripts/backfill-ledger.ts
 *
 * Production `prisma migrate deploy` already applies
 * prisma/migrations/20260904120000_backfill_paid_bill_expenses. Use this
 * script to preview counts, or to re-run the same work if that migration
 * was applied before the backfill SQL existed.
 */
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import { planExpenseForBill, BillForLedger } from '../src/lib/business/ledger'

dotenv.config()

const dryRun = process.argv.includes('--dry-run')

const databaseUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, '')
if (!databaseUrl) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 5,
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ['error', 'warn'] })

async function main() {
  console.log(dryRun ? 'Ledger backfill (dry-run)' : 'Ledger backfill')

  const paidBills = await prisma.bill.findMany({
    where: { status: 'PAID' },
    include: { vendor: true, expense: true },
  })

  const missing = paidBills.filter((b) => !b.expense)
  const alreadyLinked = paidBills.length - missing.length

  console.log(`PAID bills: ${paidBills.length}`)
  console.log(`Already have a linked expense: ${alreadyLinked}`)
  console.log(`Need an expense: ${missing.length}`)

  if (!dryRun) {
    for (const bill of missing) {
      const plan = planExpenseForBill(bill as BillForLedger)
      if (plan.action !== 'upsert') continue
      const amount = plan.data.amount.toFixed(2)
      await prisma.expense.upsert({
        where: { billId: bill.id },
        create: {
          billId: bill.id,
          date: plan.data.date,
          amount,
          categoryId: plan.data.categoryId,
          vendorId: plan.data.vendorId,
          payee: plan.data.payee,
          createdById: plan.data.createdById,
        },
        update: {
          date: plan.data.date,
          amount,
          categoryId: plan.data.categoryId,
          vendorId: plan.data.vendorId,
          payee: plan.data.payee,
        },
      })
    }
    console.log(`Upserted ${missing.length} expenses`)
  }

  const recurringCategoryIds = [
    ...new Set(
      (
        await prisma.bill.findMany({
          where: { isRecurring: true },
          select: { categoryId: true },
        })
      ).map((b) => b.categoryId),
    ),
  ]

  console.log(`Categories with recurring bills (will be FIXED): ${recurringCategoryIds.length}`)

  if (!dryRun && recurringCategoryIds.length > 0) {
    const result = await prisma.category.updateMany({
      where: { id: { in: recurringCategoryIds } },
      data: { kind: 'FIXED' },
    })
    console.log(`Marked ${result.count} categories FIXED`)
  }

  const expenseCount = await prisma.expense.count()
  const billCount = await prisma.bill.count()
  console.log(`Current totals — bills: ${billCount}, expenses: ${expenseCount}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })

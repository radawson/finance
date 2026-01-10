import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Parse DATABASE_URL - trim whitespace and remove quotes that might be in .env file
const databaseUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, '')
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Create connection pool
const pool = new Pool({
  connectionString: databaseUrl,
  // Add SSL configuration if needed
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
})

// Create Prisma adapter
const adapter = new PrismaPg(pool)

// Create Prisma client with adapter
const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
})

async function main() {
  console.log('Seeding default global categories...')

  const defaultCategories = [
    { name: 'Electricity', description: 'Electric utility bills', color: '#FFD700' },
    { name: 'Gas', description: 'Natural gas utility bills', color: '#FF6B6B' },
    { name: 'Oil', description: 'Heating oil bills', color: '#4ECDC4' },
    { name: 'Internet', description: 'Internet service provider bills', color: '#45B7D1' },
    { name: 'Water', description: 'Water utility bills', color: '#96CEB4' },
    { name: 'Phone', description: 'Phone service bills', color: '#FFEAA7' },
    { name: 'Insurance', description: 'Insurance premiums', color: '#DDA0DD' },
    { name: 'Mortgage', description: 'Mortgage payments', color: '#98D8C8' },
    { name: 'Rent', description: 'Rent payments', color: '#F7DC6F' },
    { name: 'Credit Card', description: 'Credit card payments', color: '#BB8FCE' },
    { name: 'Loan', description: 'Loan payments', color: '#85C1E2' },
    { name: 'Medical', description: 'Medical bills and expenses', color: '#F1948A' },
    { name: 'Dental', description: 'Dental bills and expenses', color: '#AED6F1' },
    { name: 'Home Repair', description: 'Home maintenance and repairs', color: '#F9E79F' },
    { name: 'Other', description: 'Other bills and expenses', color: '#BDC3C7' },
  ]

  for (const category of defaultCategories) {
    // Check if category already exists
    const existing = await prisma.category.findFirst({
      where: {
        name: category.name,
        isGlobal: true,
        userId: null,
      },
    })

    if (existing) {
      // Update existing category
      await prisma.category.update({
        where: { id: existing.id },
        data: {
          description: category.description,
          color: category.color,
        },
      })
    } else {
      // Create new category
      await prisma.category.create({
        data: {
          name: category.name,
          description: category.description,
          color: category.color,
          isGlobal: true,
          userId: null,
        },
      })
    }
  }

  console.log(`Seeded ${defaultCategories.length} global categories`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })

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

// Parse connection string to determine if SSL is needed
const isRemote = !databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1')

// Create connection pool
const pool = new Pool({
  connectionString: databaseUrl,
  // SSL configuration - handle self-signed certificates for remote connections
  ssl: process.env.DATABASE_SSL === 'true' || (process.env.DATABASE_SSL !== 'false' && isRemote)
    ? { rejectUnauthorized: false } // Allow self-signed certificates
    : false,
})

// Create Prisma adapter
const adapter = new PrismaPg(pool)

// Create Prisma client with adapter
const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
})

async function main() {
  console.log('🌱 Starting Kontado database seeding...')

  // Check database connection
  try {
    await prisma.$connect()
    console.log('✅ Database connection successful')
  } catch (error) {
    console.error('❌ Database connection failed')
    console.error('Make sure your database is running and DATABASE_URL is correctly set')
    console.error('For local development, run: docker compose up -d db')
    process.exit(1)
  }

  console.log('👤 Seeding default admin user...')

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findFirst({
    where: {
      role: 'ADMIN',
    },
  })

  if (!existingAdmin) {
    // Create default admin user
    const defaultAdmin = await prisma.user.create({
      data: {
        email: 'admin@kontado.local',
        name: 'Kontado Admin',
        password: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // "password"
        role: 'ADMIN',
        department: 'IT',
        isActive: true,
      },
    })
    console.log(`✅ Created default admin user: ${defaultAdmin.email}`)
    console.log('🔑 Default admin password: password (change this in production!)')
  } else {
    console.log('ℹ️  Admin user already exists, skipping creation')
  }

  console.log('📂 Seeding default global categories...')

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

  let categoriesCreated = 0
  let categoriesUpdated = 0

  for (const category of defaultCategories) {
    try {
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
        categoriesUpdated++
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
        categoriesCreated++
      }
    } catch (error) {
      console.error(`❌ Error seeding category "${category.name}":`, error)
    }
  }

  console.log(`📂 Categories: ${categoriesCreated} created, ${categoriesUpdated} updated`)
  console.log('🎉 Database seeding completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    try {
      await prisma.$disconnect()
      await pool.end()
      console.log('🔌 Database connection closed')
    } catch (error) {
      console.error('⚠️  Error closing database connection:', error)
    }
  })

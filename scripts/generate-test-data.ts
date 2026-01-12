import { PrismaClient, RecurrenceFrequency, BillStatus } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import { addMonths, addYears, subMonths, subYears, setDate, getDate } from 'date-fns'

// Load environment variables
dotenv.config()

// Parse DATABASE_URL - trim whitespace and remove quotes
const databaseUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, '')
if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is not set')
  process.exit(1)
}

console.log(`🔗 Using DATABASE_URL: ${databaseUrl.replace(/:([^:@]{4})[^:@]*@/, ':****@')}`)

// Create connection pool
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

// Create Prisma adapter and client
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
})

async function main() {
  console.log('🧪 Starting test data generation for budget forecasting...')

  try {
    await prisma.$connect()
    console.log('✅ Database connection successful')

    // Get or create a test user
    let testUser = await prisma.user.findFirst({
      where: { email: 'test@kontado.local' },
    })

    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'test@kontado.local',
          name: 'Test User',
          password: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // "password"
          role: 'USER',
          isActive: true,
        },
      })
      console.log('✅ Created test user')
    } else {
      console.log('ℹ️  Test user already exists')
    }

    // Get or create categories
    const categories = await Promise.all([
      prisma.category.upsert({
        where: { id: 'test-category-electric' },
        update: {},
        create: {
          id: 'test-category-electric',
          name: 'Electric',
          description: 'Electric utility bills',
          color: '#FFD700',
          isGlobal: true,
        },
      }),
      prisma.category.upsert({
        where: { id: 'test-category-water' },
        update: {},
        create: {
          id: 'test-category-water',
          name: 'Water',
          description: 'Water utility bills',
          color: '#00BFFF',
          isGlobal: true,
        },
      }),
      prisma.category.upsert({
        where: { id: 'test-category-insurance' },
        update: {},
        create: {
          id: 'test-category-insurance',
          name: 'Insurance',
          description: 'Insurance payments',
          color: '#32CD32',
          isGlobal: true,
        },
      }),
      prisma.category.upsert({
        where: { id: 'test-category-gas' },
        update: {},
        create: {
          id: 'test-category-gas',
          name: 'Gas',
          description: 'Gas utility bills',
          color: '#FF6347',
          isGlobal: true,
        },
      }),
      prisma.category.upsert({
        where: { id: 'test-category-phone' },
        update: {},
        create: {
          id: 'test-category-phone',
          name: 'Phone',
          description: 'Phone bills',
          color: '#9370DB',
          isGlobal: true,
        },
      }),
      prisma.category.upsert({
        where: { id: 'test-category-rent' },
        update: {},
        create: {
          id: 'test-category-rent',
          name: 'Rent',
          description: 'Rent payments',
          color: '#FFA500',
          isGlobal: true,
        },
      }),
    ])

    console.log('✅ Categories ready')

    // Get or create vendors
    const vendors = await Promise.all([
      prisma.vendor.upsert({
        where: { id: 'test-vendor-electric' },
        update: {},
        create: {
          id: 'test-vendor-electric',
          name: 'Electric Company',
          email: 'billing@electric.com',
          phone: '+1 (555) 123-4567',
          createdById: testUser.id,
        },
      }),
      prisma.vendor.upsert({
        where: { id: 'test-vendor-water' },
        update: {},
        create: {
          id: 'test-vendor-water',
          name: 'Water Utility',
          email: 'billing@water.com',
          phone: '+1 (555) 234-5678',
          createdById: testUser.id,
        },
      }),
      prisma.vendor.upsert({
        where: { id: 'test-vendor-insurance' },
        update: {},
        create: {
          id: 'test-vendor-insurance',
          name: 'Insurance Co',
          email: 'billing@insurance.com',
          phone: '+1 (555) 345-6789',
          createdById: testUser.id,
        },
      }),
      prisma.vendor.upsert({
        where: { id: 'test-vendor-gas' },
        update: {},
        create: {
          id: 'test-vendor-gas',
          name: 'Gas Company',
          email: 'billing@gas.com',
          phone: '+1 (555) 456-7890',
          createdById: testUser.id,
        },
      }),
      prisma.vendor.upsert({
        where: { id: 'test-vendor-phone' },
        update: {},
        create: {
          id: 'test-vendor-phone',
          name: 'Phone Company',
          email: 'billing@phone.com',
          phone: '+1 (555) 567-8901',
          createdById: testUser.id,
        },
      }),
      prisma.vendor.upsert({
        where: { id: 'test-vendor-rent' },
        update: {},
        create: {
          id: 'test-vendor-rent',
          name: 'Property Management',
          email: 'billing@rent.com',
          phone: '+1 (555) 678-9012',
          createdById: testUser.id,
        },
      }),
    ])

    console.log('✅ Vendors ready')

    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    // 1. Electric bills: Sep $200, Oct $250, Nov $275 (trending up) - should predict Dec ~$235
    console.log('📊 Creating electric bills (trending up)...')
    const electricBills = [
      { month: 8, year: currentYear, amount: 200 }, // September
      { month: 9, year: currentYear, amount: 250 }, // October
      { month: 10, year: currentYear, amount: 275 }, // November
    ]

    for (const bill of electricBills) {
      const dueDate = new Date(bill.year, bill.month, 15)
      await prisma.bill.upsert({
        where: {
          id: `test-electric-${bill.year}-${bill.month}`,
        },
        update: {
          amount: bill.amount,
          dueDate,
        },
        create: {
          id: `test-electric-${bill.year}-${bill.month}`,
          title: `Electric Bill - ${new Date(bill.year, bill.month).toLocaleString('default', { month: 'long', year: 'numeric' })}`,
          amount: bill.amount,
          dueDate,
          categoryId: categories[0].id,
          vendorId: vendors[0].id,
          createdById: testUser.id,
          status: BillStatus.PAID,
          paidDate: dueDate,
        },
      })
    }

    // 2. Water bills: Consistent $150/month for 6 months (stable pattern)
    console.log('📊 Creating water bills (stable pattern)...')
    for (let i = 0; i < 6; i++) {
      const date = subMonths(now, 5 - i)
      const dueDate = setDate(date, 10)
      await prisma.bill.upsert({
        where: {
          id: `test-water-${date.getFullYear()}-${date.getMonth()}`,
        },
        update: {
          amount: 150,
          dueDate,
        },
        create: {
          id: `test-water-${date.getFullYear()}-${date.getMonth()}`,
          title: `Water Bill - ${date.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
          amount: 150,
          dueDate,
          categoryId: categories[1].id,
          vendorId: vendors[1].id,
          createdById: testUser.id,
          status: BillStatus.PAID,
          paidDate: dueDate,
        },
      })
    }

    // 3. Insurance: $500/year for 3 years (seasonal pattern - same month each year)
    console.log('📊 Creating insurance bills (seasonal pattern)...')
    for (let year = 0; year < 3; year++) {
      const date = subYears(now, 2 - year)
      const dueDate = new Date(date.getFullYear(), 2, 1) // March 1st each year
      await prisma.bill.upsert({
        where: {
          id: `test-insurance-${date.getFullYear()}`,
        },
        update: {
          amount: 500,
          dueDate,
        },
        create: {
          id: `test-insurance-${date.getFullYear()}`,
          title: `Insurance Premium - ${date.getFullYear()}`,
          amount: 500,
          dueDate,
          categoryId: categories[2].id,
          vendorId: vendors[2].id,
          createdById: testUser.id,
          status: BillStatus.PAID,
          paidDate: dueDate,
        },
      })
    }

    // 4. Gas bills: Varying amounts with slight upward trend ($80, $85, $90, $95)
    console.log('📊 Creating gas bills (slight upward trend)...')
    const gasAmounts = [80, 85, 90, 95]
    for (let i = 0; i < gasAmounts.length; i++) {
      const date = subMonths(now, 3 - i)
      const dueDate = setDate(date, 20)
      await prisma.bill.upsert({
        where: {
          id: `test-gas-${date.getFullYear()}-${date.getMonth()}`,
        },
        update: {
          amount: gasAmounts[i],
          dueDate,
        },
        create: {
          id: `test-gas-${date.getFullYear()}-${date.getMonth()}`,
          title: `Gas Bill - ${date.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
          amount: gasAmounts[i],
          dueDate,
          categoryId: categories[3].id,
          vendorId: vendors[3].id,
          createdById: testUser.id,
          status: BillStatus.PAID,
          paidDate: dueDate,
        },
      })
    }

    // 5. Phone bills: $45/month for 12 months (perfect monthly pattern)
    console.log('📊 Creating phone bills (perfect monthly pattern)...')
    for (let i = 0; i < 12; i++) {
      const date = subMonths(now, 11 - i)
      const dueDate = setDate(date, 5)
      await prisma.bill.upsert({
        where: {
          id: `test-phone-${date.getFullYear()}-${date.getMonth()}`,
        },
        update: {
          amount: 45,
          dueDate,
        },
        create: {
          id: `test-phone-${date.getFullYear()}-${date.getMonth()}`,
          title: `Phone Bill - ${date.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
          amount: 45,
          dueDate,
          categoryId: categories[4].id,
          vendorId: vendors[4].id,
          createdById: testUser.id,
          status: BillStatus.PAID,
          paidDate: dueDate,
        },
      })
    }

    // 6. Rent: $1200/month for 24 months (long-term stable pattern)
    console.log('📊 Creating rent bills (long-term stable pattern)...')
    for (let i = 0; i < 24; i++) {
      const date = subMonths(now, 23 - i)
      const dueDate = setDate(date, 1)
      await prisma.bill.upsert({
        where: {
          id: `test-rent-${date.getFullYear()}-${date.getMonth()}`,
        },
        update: {
          amount: 1200,
          dueDate,
        },
        create: {
          id: `test-rent-${date.getFullYear()}-${date.getMonth()}`,
          title: `Rent - ${date.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
          amount: 1200,
          dueDate,
          categoryId: categories[5].id,
          vendorId: vendors[5].id,
          createdById: testUser.id,
          status: BillStatus.PAID,
          paidDate: dueDate,
        },
      })
    }

    // 7. Some bills with isRecurring: true but only 1-2 data points (to test synthetic data generation)
    console.log('📊 Creating bills with recurring flag but < 3 data points...')
    
    // Create a category and vendor for this
    const testCategory = await prisma.category.upsert({
      where: { id: 'test-category-new-service' },
      update: {},
      create: {
        id: 'test-category-new-service',
        name: 'New Service',
        description: 'New recurring service',
        color: '#FF69B4',
        isGlobal: true,
      },
    })

    const testVendor = await prisma.vendor.upsert({
      where: { id: 'test-vendor-new-service' },
      update: {},
      create: {
        id: 'test-vendor-new-service',
        name: 'New Service Provider',
        email: 'billing@newservice.com',
        phone: '+1 (555) 999-0000',
        createdById: testUser.id,
      },
    })

    // Create 1 bill with recurring flag
    const newServiceDate = subMonths(now, 1)
    const newServiceBill = await prisma.bill.upsert({
      where: {
        id: 'test-new-service-1',
      },
      update: {
        amount: 75,
        dueDate: newServiceDate,
      },
      create: {
        id: 'test-new-service-1',
        title: 'New Service - October',
        amount: 75,
        dueDate: newServiceDate,
        categoryId: testCategory.id,
        vendorId: testVendor.id,
        createdById: testUser.id,
        isRecurring: true,
        status: BillStatus.PAID,
        paidDate: newServiceDate,
      },
    })

    // Create recurrence pattern for this bill
    await prisma.recurrencePattern.upsert({
      where: {
        id: `recurrence-${newServiceBill.id}`,
      },
      update: {},
      create: {
        id: `recurrence-${newServiceBill.id}`,
        billId: newServiceBill.id,
        frequency: RecurrenceFrequency.MONTHLY,
        dayOfMonth: getDate(newServiceDate),
        startDate: newServiceDate,
      },
    })

    console.log('✅ Test data generation complete!')
    console.log('')
    console.log('📋 Generated test data:')
    console.log('  - Electric bills: 3 bills (Sep $200, Oct $250, Nov $275) - trending up')
    console.log('  - Water bills: 6 bills at $150/month - stable pattern')
    console.log('  - Insurance: 3 bills at $500/year (March) - seasonal pattern')
    console.log('  - Gas bills: 4 bills ($80, $85, $90, $95) - slight upward trend')
    console.log('  - Phone bills: 12 bills at $45/month - perfect monthly pattern')
    console.log('  - Rent: 24 bills at $1200/month - long-term stable pattern')
    console.log('  - New Service: 1 bill with recurring flag - tests synthetic data generation')
    console.log('')
    console.log('🧪 You can now test the budget forecasting algorithms!')
  } catch (error) {
    console.error('❌ Error generating test data:', error)
    throw error
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

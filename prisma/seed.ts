import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Parse DATABASE_URL - trim whitespace and remove quotes that might be in .env file
const databaseUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, '')
if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is not set')
  console.error('Please set DATABASE_URL in your .env file or environment')
  process.exit(1)
}

console.log(`🔗 Using DATABASE_URL: ${databaseUrl.replace(/:([^:@]{4})[^:@]*@/, ':****@')}`)

// Parse the connection string into individual components (same as main app)
let poolConfig: any
try {
  const url = new URL(databaseUrl)
  const dbName = url.pathname.slice(1).split('?')[0] // Remove leading / and query params

  // URL-decode the password in case it was encoded
  const password = url.password ? decodeURIComponent(url.password) : undefined

  poolConfig = {
    host: url.hostname,
    port: parseInt(url.port || '5432', 10),
    database: dbName,
    user: url.username ? decodeURIComponent(url.username) : undefined,
    password: password,
    // SSL configuration - same as main app
    ssl: process.env.DATABASE_SSL === 'true' || process.env.DATABASE_SSL === 'false'
      ? (process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false)
      : (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1'
          ? { rejectUnauthorized: false } // For remote connections, allow self-signed certs
          : false),
    // Connection pool settings - increased timeout for remote databases
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // Increased from 2000ms for remote connections
  }

  console.log(`🌐 Connecting to database: ${url.hostname}:${url.port}/${dbName} (user: ${url.username})`)
} catch (e) {
  // Fallback to connection string if URL parsing fails
  console.warn('⚠️  Failed to parse DATABASE_URL, using connectionString directly')
  const isRemote = !databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1')
  poolConfig = {
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === 'true' || (process.env.DATABASE_SSL !== 'false' && isRemote)
      ? { rejectUnauthorized: false }
      : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }
}

// Create connection pool with parsed configuration
const pool = new Pool(poolConfig)

// Create Prisma adapter
const adapter = new PrismaPg(pool)

// Create Prisma client with adapter
const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
})

async function main() {
  console.log('🌱 Starting Kontado database seeding...')

  // Check database connection and write permissions
  try {
    await prisma.$connect()
    console.log('✅ Database connection successful')

    // Test write permissions by attempting a simple operation
    // First try a SELECT to ensure basic connectivity
    await prisma.$queryRaw`SELECT 1`
    console.log('✅ Database basic connectivity confirmed')

    // Now test write permissions by trying to create a test record
    // We'll use a transaction to test write capability
    try {
      await prisma.$transaction(async (tx) => {
        // Try to execute a simple write operation within a transaction
        await tx.$queryRaw`CREATE TEMP TABLE seed_test (id SERIAL PRIMARY KEY)`
        await tx.$queryRaw`DROP TABLE seed_test`
      })
      console.log('✅ Database write permissions confirmed')
    } catch (writeError: any) {
      if (writeError.message?.includes('read-only transaction')) {
        console.error('❌ Database is in read-only mode!')
        console.error('')
        console.error('🚨 READ-ONLY CONNECTION DETECTED!')
        console.error('This usually means you\'re connecting to a read-only database replica.')
        console.error('')
        console.error('Possible solutions:')
        console.error('1. Check your DATABASE_URL - ensure it points to the primary/write database')
        console.error('2. If using a database cluster, make sure you\'re connecting to the primary instance')
        console.error('3. Verify database user permissions allow writes')
        console.error('4. Check if there are connection pool settings forcing read-only mode')
        console.error('5. Try running: psql "$DATABASE_URL" -c "SELECT pg_is_in_recovery()"')
        console.error('   (should return "f" for primary, "t" for replica)')
        console.error('')
        throw writeError
      } else {
        // Re-throw other errors
        throw writeError
      }
    }
  } catch (error: any) {
    console.error('❌ Database connection or permissions failed')

    if (error.message?.includes('read-only transaction')) {
      console.error('')
      console.error('🚨 READ-ONLY CONNECTION DETECTED!')
      console.error('Your database connection is set to read-only mode.')
      console.error('')
      console.error('🔍 DIAGNOSIS:')
      console.error('- You might be connecting to a read-only replica in a database cluster')
      console.error('- Your DATABASE_URL might point to a read-only instance')
      console.error('- Database user might have read-only permissions')
      console.error('')
      console.error('🛠️  SOLUTIONS:')
      console.error('1. Verify DATABASE_URL points to the primary/writable database')
      console.error('2. For database clusters, ensure you\'re connecting to the primary instance')
      console.error('3. Check database user permissions: GRANT ALL PRIVILEGES ON DATABASE...')
      console.error('4. Test with: psql "$DATABASE_URL" -c "SELECT pg_is_in_recovery()"')
      console.error('   (should return "f" for primary, "t" for replica)')
      console.error('')
    } else if (error.message?.includes('Can\'t reach database server')) {
      console.error('')
      console.error('🌐 DATABASE SERVER UNREACHABLE')
      console.error('The database server at the specified host/port is not responding.')
      console.error('')
      console.error('🔍 POSSIBLE CAUSES:')
      console.error('- Database server is not running')
      console.error('- Firewall blocking connections')
      console.error('- Wrong host/port in DATABASE_URL')
      console.error('- Network connectivity issues')
      console.error('')
      console.error('🛠️  SOLUTIONS:')
      console.error('1. Start database: docker compose up -d db (for local)')
      console.error('2. Check DATABASE_URL host and port')
      console.error('3. Test connectivity: ping <host>')
      console.error('4. Verify firewall rules')
      console.error('')
    } else {
      console.error('')
      console.error('🤔 UNEXPECTED ERROR')
      console.error('Make sure your database is running and DATABASE_URL is correctly set')
      console.error('For local development, run: docker compose up -d db')
      console.error('')
    }

    console.error('📋 Error details:', error.message)
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
    { name: 'Alarm', description: 'Alarm system and monitoring', color: '#FFD700' },
    { name: 'Auto Repairs', description: 'Automotive Repairs and upgrades', color: '#FFD700' },
    { name: 'Cleaning', description: 'Cleaning and maintenance', color: '#FFD700' },
    { name: 'Credit Card', description: 'Credit card payments', color: '#BB8FCE' },
    { name: 'Dental', description: 'Dental bills and expenses', color: '#AED6F1' },
    { name: 'Education', description: 'Education and learning', color: '#FFEAA7' },
    { name: 'Electricity', description: 'Electric utility bills', color: '#FFD700' },
    { name: 'Entertainment', description: 'Entertainment and leisure', color: '#45B7D1' },
    { name: 'Food', description: 'Food and groceries', color: '#FFD700' },
    { name: 'Gas', description: 'Natural gas utility bills', color: '#FF6B6B' },
    { name: 'Health', description: 'Healthcare and insurance', color: '#96CEB4' },
    { name: 'Home Repair', description: 'Home maintenance and repairs', color: '#F9E79F' },
    { name: 'Housing', description: 'Housing and utilities', color: '#4ECDC4' },
    { name: 'Insurance', description: 'Insurance premiums', color: '#DDA0DD' },
    { name: 'Internet', description: 'Internet service provider bills', color: '#45B7D1' },
    { name: 'Laundry', description: 'Laundry and dry cleaning', color: '#FFD700' },
    { name: 'Loan', description: 'Loan payments', color: '#85C1E2' },
    { name: 'Maintenance', description: 'Maintenance and repairs', color: '#FFD700' },
    { name: 'Medical', description: 'Medical bills and expenses', color: '#F1948A' },
    { name: 'Miscellaneous', description: 'Miscellaneous expenses', color: '#98D8C8' },
    { name: 'Mortgage', description: 'Mortgage payments', color: '#98D8C8' },
    { name: 'Oil', description: 'Heating oil bills', color: '#4ECDC4' },
    { name: 'Other', description: 'Other bills and expenses', color: '#BDC3C7' },
    { name: 'Personal Care', description: 'Personal care and grooming', color: '#DDA0DD' },
    { name: 'Phone', description: 'Phone service bills', color: '#FFEAA7' },
    { name: 'Rent', description: 'Rent payments', color: '#F7DC6F' },
    { name: 'Renovation', description: 'Renovation and remodeling', color: '#FFD700' },
    { name: 'Security', description: 'Security and surveillance', color: '#FFD700' },
    { name: 'Transportation', description: 'Transportation costs', color: '#FF6B6B' },
    { name: 'Water', description: 'Water utility bills', color: '#96CEB4' },
    { name: 'Travel', description: 'Travel and transportation', color: '#BDC3C7' },
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

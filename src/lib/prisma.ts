import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = global as unknown as { 
  prisma: PrismaClient
  pool: Pool 
}

// Parse DATABASE_URL to extract connection details
// Trim whitespace and remove quotes that might be in the .env file
const databaseUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, '')
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Debug: Log connection details (without password) in development
if (process.env.NODE_ENV === 'development') {
  try {
    const url = new URL(databaseUrl)
    console.log(`[Prisma] Connecting to database: ${url.protocol}//${url.hostname}:${url.port}${url.pathname}`)
  } catch (e) {
    // If URL parsing fails, just log that we have a connection string
    console.log('[Prisma] DATABASE_URL is set (length:', databaseUrl.length, ')')
  }
}

// Create connection pool with explicit options
// The pg library sometimes has issues with connection strings containing special characters
const pool = globalForPrisma.pool || new Pool({
  connectionString: databaseUrl,
  // Add SSL configuration if needed (set to false for local dev, or configure for production)
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  // Connection pool settings
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Add error handling for pool connections
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err)
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.pool = pool
}

// Create Prisma adapter
const adapter = new PrismaPg(pool)

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma


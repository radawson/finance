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

// Parse the connection string into individual components
// This helps avoid issues with special characters in passwords
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
    // SSL configuration - handle self-signed certificates
    // If DATABASE_SSL is explicitly set, use it; otherwise try to detect from connection string
    ssl: process.env.DATABASE_SSL === 'true' || process.env.DATABASE_SSL === 'false'
      ? (process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false)
      : (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' 
          ? { rejectUnauthorized: false } // For remote connections, allow self-signed certs
          : false),
    // Connection pool settings
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }
  
  // Debug: Log connection details (without password) in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Prisma] Connecting to database: ${url.protocol}//${url.hostname}:${url.port}/${dbName} (user: ${url.username})`)
  }
} catch (e) {
  // Fallback to connection string if URL parsing fails
  console.warn('[Prisma] Failed to parse DATABASE_URL, using connectionString directly')
  // For remote connections, enable SSL with self-signed cert support
  const isRemote = !databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1')
  poolConfig = {
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === 'true' || (process.env.DATABASE_SSL !== 'false' && isRemote)
      ? { rejectUnauthorized: false } // Allow self-signed certificates
      : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }
}

// Create connection pool with parsed configuration
const pool = globalForPrisma.pool || new Pool(poolConfig)

// Add error handling for pool connections
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err)
})

// Test the connection in development
if (process.env.NODE_ENV === 'development' && !globalForPrisma.pool) {
  pool.query('SELECT 1 as test').then(() => {
    console.log('[Prisma] Database connection test successful')
  }).catch((err) => {
    console.error('[Prisma] Database connection test failed:', err.message)
  })
}

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


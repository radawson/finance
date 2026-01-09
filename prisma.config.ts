import { defineConfig } from 'prisma/config'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://kontado:PASSword01!!@localhost:5432/kontado?schema=public',
  },
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
})


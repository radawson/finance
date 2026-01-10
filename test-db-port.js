#!/usr/bin/env node

/**
 * Database Port Tester
 * Tests common PostgreSQL ports to find the correct one for your cluster
 * This script mimics your Prisma configuration for accurate testing
 */

const { Pool } = require('pg');
require('dotenv').config();

// Ports to test
const PORTS = [5432, 5433];

// Parse DATABASE_URL with same logic as your Prisma setup
let poolConfig;

if (process.env.DATABASE_URL) {
  const databaseUrl = process.env.DATABASE_URL.trim().replace(/^["']|["']$/g, '');

  try {
    const url = new URL(databaseUrl);
    const dbName = url.pathname.slice(1).split('?')[0];
    const password = url.password ? decodeURIComponent(url.password) : undefined;

    // SSL configuration - same as your Prisma setup
    const ssl = process.env.DATABASE_SSL === 'true' || process.env.DATABASE_SSL === 'false'
      ? (process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false)
      : (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1'
          ? { rejectUnauthorized: false } // For remote connections, allow self-signed certs
          : false);

    poolConfig = {
      host: url.hostname,
      port: parseInt(url.port || '5432', 10),
      database: dbName,
      user: url.username ? decodeURIComponent(url.username) : undefined,
      password: password,
      ssl: ssl,
      // Same connection pool settings as your Prisma config
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    console.log('Using connection details from DATABASE_URL');
    console.log(`Host: ${url.hostname}`);
    console.log(`User: ${url.username}`);
    console.log(`Database: ${dbName}`);
    console.log(`SSL: ${ssl ? 'enabled' : 'disabled'}\n`);

  } catch (e) {
    console.warn('Failed to parse DATABASE_URL, using connectionString directly');
    const isRemote = !databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1');
    poolConfig = {
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === 'true' || (process.env.DATABASE_SSL !== 'false' && isRemote)
        ? { rejectUnauthorized: false }
        : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };
  }
} else {
  // Use defaults
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'kontado';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'kontado';

  poolConfig = {
    host,
    user,
    password,
    database,
    ssl: false, // Local connections don't need SSL
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  console.log('Using default/environment variables');
  console.log(`Host: ${host}`);
  console.log(`User: ${user}`);
  console.log(`Database: ${database}\n`);
}

async function testPort(port) {
  const testConfig = { ...poolConfig, port };

  const pool = new Pool(testConfig);

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT version()');
    client.release();
    await pool.end();

    return {
      success: true,
      version: result.rows[0]?.version || 'Connected',
    };
  } catch (error) {
    await pool.end();
    return {
      success: false,
      error: error.message,
    };
  }
}

async function main() {
  console.log('Testing ports...\n');

  let success = false;

  for (const port of PORTS) {
    process.stdout.write(`Testing port ${port}... `);

    const result = await testPort(port);

    if (result.success) {
      console.log('\x1b[32m✓ SUCCESS\x1b[0m');
      console.log(`  \x1b[32mPort ${port} is working!\x1b[0m`);
      console.log(`  Database version: ${result.version.split('\n')[0]}`);
      console.log('');
      console.log('\x1b[32mWorking connection string:\x1b[0m');
      console.log(`postgresql://${poolConfig.user}:${poolConfig.password}@${poolConfig.host}:${port}/${poolConfig.database}?schema=public`);
      success = true;
      break;
    } else {
      console.log('\x1b[31m✗ FAILED\x1b[0m');
      console.log(`  Error: ${result.error}`);
    }
  }

  console.log('');

  if (!success) {
    console.log('\x1b[31mNone of the tested ports worked.\x1b[0m');
    console.log('Please check:');
    console.log(`  1. Database host is correct: ${poolConfig.host}`);
    console.log('  2. Database is running and accessible');
    console.log('  3. Firewall/network settings allow connections');
    console.log('  4. Credentials are correct');
    console.log('  5. SSL requirements (database may require SSL)');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});

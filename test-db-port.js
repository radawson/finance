#!/usr/bin/env node

/**
 * Database Port Tester
 * Tests common PostgreSQL ports to find the correct one for your cluster
 */

const { Pool } = require('pg');
require('dotenv').config();

// Ports to test
const PORTS = [5432, 5433];

// Parse DATABASE_URL if available
let host, user, password, database;

if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  host = url.hostname;
  user = url.username;
  password = url.password;
  database = url.pathname.slice(1).split('?')[0];
  
  console.log('Using connection details from DATABASE_URL');
  console.log(`Host: ${host}`);
  console.log(`User: ${user}`);
  console.log(`Database: ${database}\n`);
} else {
  // Use defaults
  host = process.env.DB_HOST || 'localhost';
  user = process.env.DB_USER || 'kontado';
  password = process.env.DB_PASSWORD || '';
  database = process.env.DB_NAME || 'kontado';
  
  console.log('Using default/environment variables');
  console.log(`Host: ${host}`);
  console.log(`User: ${user}`);
  console.log(`Database: ${database}\n`);
}

async function testPort(port) {
  const pool = new Pool({
    host,
    port,
    user,
    password,
    database,
    connectionTimeoutMillis: 3000,
  });

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
      console.log(`postgresql://${user}:${password}@${host}:${port}/${database}?schema=public`);
      success = true;
      break;
    } else {
      console.log('\x1b[31m✗ FAILED\x1b[0m');
      if (process.env.DEBUG) {
        console.log(`  Error: ${result.error}`);
      }
    }
  }
  
  console.log('');
  
  if (!success) {
    console.log('\x1b[31mNone of the tested ports worked.\x1b[0m');
    console.log('Please check:');
    console.log(`  1. Database host is correct: ${host}`);
    console.log('  2. Database is running and accessible');
    console.log('  3. Firewall/network settings allow connections');
    console.log('  4. Credentials are correct');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});

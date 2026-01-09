/**
 * Socket.IO Route Placeholder
 * 
 * Note: Socket.IO functionality is implemented in server.js (custom Next.js server).
 * This file exists only to satisfy Next.js type validation during build.
 * 
 * Actual Socket.IO server is available at: /socket.io/
 */

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    message: 'Socket.IO is handled by the custom server (server.js)',
    socketPath: '/socket.io/',
  })
}


/**
 * Custom Next.js Server with Socket.IO Integration
 * 
 * This server enables real-time WebSocket connections alongside Next.js
 * for the Informejo ticketing system.
 */

const { createServer } = require('http')
const { parse } = require('url')
const { resolve } = require('path')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3003', 10)

// Initialize Next.js app with explicit configuration for production
const app = next({ 
  dev,
  dir: resolve(__dirname), // Explicitly set the project directory
})
const handle = app.getRequestHandler()

app.prepare().then(() => {
  // Create HTTP server
  const httpServer = createServer(async (req, res) => {
    try {
      // Parse URL using Node's url.parse (Next.js standard approach)
      // The 'true' parameter parses query strings into an object
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      // Log full error details for debugging
      console.error('Error occurred handling', req.url)
      console.error('Error details:', err)
      if (err.stack) {
        console.error('Stack trace:', err.stack)
      }
      res.statusCode = 500
      res.end('Internal server error')
    }
  })

  // Initialize Socket.IO
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  })

  // Socket.IO connection handler
  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`)

    // Join ticket room
    socket.on('join-ticket', (ticketId) => {
      const room = `ticket:${ticketId}`
      socket.join(room)
      console.log(`[Socket.IO] Socket ${socket.id} joined ${room}`)
    })

    // Leave ticket room
    socket.on('leave-ticket', (ticketId) => {
      const room = `ticket:${ticketId}`
      socket.leave(room)
      console.log(`[Socket.IO] Socket ${socket.id} left ${room}`)
    })

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`)
    })

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`[Socket.IO] Socket error for ${socket.id}:`, error)
    })
  })

  // Store Socket.IO instance globally for API routes
  global.io = io

  // Start server
  httpServer
    .once('error', (err) => {
      console.error('Server error:', err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                   🚀 Informejo Server                      ║
╠════════════════════════════════════════════════════════════╣
║  Environment: ${dev ? 'Development' : 'Production'.padEnd(43)} ║
║  HTTP Server: http://${hostname}:${port.toString().padEnd(37)} ║
║  Socket.IO:   Connected and ready                          ║
║  Status:      Ready to accept connections                  ║
╚════════════════════════════════════════════════════════════╝
      `)
    })

  // Graceful shutdown
  const gracefulShutdown = (signal) => {
    console.log(`\n[${signal}] Shutting down gracefully...`)
    
    // Close Socket.IO connections
    io.close(() => {
      console.log('[Socket.IO] All connections closed')
    })

    // Close HTTP server
    httpServer.close(() => {
      console.log('[HTTP] Server closed')
      process.exit(0)
    })

    // Force close after 10 seconds
    setTimeout(() => {
      console.error('Forcing shutdown after timeout')
      process.exit(1)
    }, 10000)
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
}).catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})


/**
 * Socket.IO Server Helper
 * 
 * Provides utilities for emitting Socket.IO events from API routes
 */

import { Server as SocketIOServer } from 'socket.io'

/**
 * Get the global Socket.IO instance
 * @returns Socket.IO server instance or null if not initialized
 */
export function getSocketIO(): SocketIOServer | null {
  if (typeof global !== 'undefined' && (global as any).io) {
    return (global as any).io as SocketIOServer
  }
  
  console.warn('[Socket.IO] Server not initialized yet')
  return null
}

/**
 * Emit an event to a specific ticket room
 * @param ticketId - The ticket ID
 * @param event - The event name
 * @param data - The data to emit
 */
export function emitToTicket(ticketId: string, event: string, data: any): void {
  const io = getSocketIO()
  if (io) {
    const room = `ticket:${ticketId}`
    io.to(room).emit(event, data)
    console.log(`[Socket.IO] Emitted '${event}' to ${room}`)
  }
}

/**
 * Emit an event to all connected clients
 * @param event - The event name
 * @param data - The data to emit
 */
export function emitToAll(event: string, data: any): void {
  const io = getSocketIO()
  if (io) {
    io.emit(event, data)
    console.log(`[Socket.IO] Emitted '${event}' to all clients`)
  }
}

/**
 * Emit an event to all admin clients
 * Note: This requires clients to join an 'admins' room when authenticated
 * @param event - The event name
 * @param data - The data to emit
 */
export function emitToAdmins(event: string, data: any): void {
  const io = getSocketIO()
  if (io) {
    io.to('admins').emit(event, data)
    console.log(`[Socket.IO] Emitted '${event}' to admins room`)
  }
}

/**
 * Check if Socket.IO server is available
 * @returns true if Socket.IO is initialized
 */
export function isSocketIOAvailable(): boolean {
  return getSocketIO() !== null
}

// Export event types for consistency
export const SocketEvents = {
  TICKET_CREATED: 'ticket:created',
  TICKET_UPDATED: 'ticket:updated',
  TICKET_DELETED: 'ticket:deleted',
  TICKET_ASSIGNED: 'ticket:assigned',
  TICKET_STATUS_CHANGED: 'ticket:status-changed',
  COMMENT_ADDED: 'comment:added',
  ATTACHMENT_ADDED: 'attachment:added',
} as const

export type SocketEventType = typeof SocketEvents[keyof typeof SocketEvents]


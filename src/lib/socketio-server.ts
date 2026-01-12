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
 * Emit an event to a specific bill room
 * @param billId - The bill ID
 * @param event - The event name
 * @param data - The data to emit
 */
export function emitToBill(billId: string, event: string, data: any): void {
  const io = getSocketIO()
  if (io) {
    const room = `bill:${billId}`
    io.to(room).emit(event, data)
    console.log(`[Socket.IO] Emitted '${event}' to ${room}`)
  }
}

/**
 * Emit an event to a specific vendor room
 * @param vendorId - The vendor ID
 * @param event - The event name
 * @param data - The data to emit
 */
export function emitToVendor(vendorId: string, event: string, data: any): void {
  const io = getSocketIO()
  if (io) {
    const room = `vendor:${vendorId}`
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
  BILL_CREATED: 'bill:created',
  BILL_UPDATED: 'bill:updated',
  BILL_DELETED: 'bill:deleted',
  BILL_STATUS_CHANGED: 'bill:status-changed',
  VENDOR_CREATED: 'vendor:created',
  VENDOR_UPDATED: 'vendor:updated',
  VENDOR_ACCOUNT_CREATED: 'vendor:account:created',
  VENDOR_ACCOUNT_UPDATED: 'vendor:account:updated',
  VENDOR_ACCOUNT_DELETED: 'vendor:account:deleted',
  COMMENT_ADDED: 'comment:added',
  ATTACHMENT_ADDED: 'attachment:added',
} as const

export type SocketEventType = typeof SocketEvents[keyof typeof SocketEvents]


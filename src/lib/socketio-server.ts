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
 * Emit an event to a specific user's personal room
 * Note: Users automatically join their user:{userId} room on connection
 * @param userId - The user ID
 * @param event - The event name
 * @param data - The data to emit
 */
export function emitToUser(userId: string, event: string, data: any): void {
  const io = getSocketIO()
  if (io) {
    const room = `user:${userId}`
    io.to(room).emit(event, data)
    console.log(`[Socket.IO] Emitted '${event}' to ${room}`)
  }
}

/**
 * Check if Socket.IO server is available
 * @returns true if Socket.IO is initialized
 */
export function isSocketIOAvailable(): boolean {
  return getSocketIO() !== null
}

/**
 * WebSocket Event Strategy:
 * 
 * SILENT UI UPDATES (Room-based):
 * - Use WebSocket for silent UI updates only (no toasts)
 * - Target specific rooms (bill:{billId}, vendor:{vendorId})
 * - Only users viewing that specific resource get updates
 * - User who makes change gets toast from API response (not WebSocket)
 * 
 * NOTIFICATIONS (User-based):
 * - For important events that need user attention
 * - Emit to user:{userId} room
 * - Creates notification in database
 * - User can review in Notification Center
 * 
 * Pattern:
 * - bill:updated → bill:{billId} room (silent UI update for viewers)
 * - notification:new → user:{userId} room (notification for bill owner)
 */

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
  NOTIFICATION_NEW: 'notification:new',
} as const

export type SocketEventType = typeof SocketEvents[keyof typeof SocketEvents]


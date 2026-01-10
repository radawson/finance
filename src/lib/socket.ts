import { Server as NetServer } from 'http'
import { NextApiResponse } from 'next'
import { Server as SocketIOServer } from 'socket.io'

export type NextApiResponseServerIO = NextApiResponse & {
  socket: {
    server: NetServer & {
      io: SocketIOServer
    }
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}

// Socket.io events
export enum SocketEvent {
  BILL_CREATED = 'bill:created',
  BILL_UPDATED = 'bill:updated',
  BILL_DELETED = 'bill:deleted',
  BILL_STATUS_CHANGED = 'bill:status-changed',
  VENDOR_CREATED = 'vendor:created',
  VENDOR_UPDATED = 'vendor:updated',
  COMMENT_ADDED = 'comment:added',
  ATTACHMENT_ADDED = 'attachment:added',
}


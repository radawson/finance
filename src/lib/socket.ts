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
  TICKET_CREATED = 'ticket:created',
  TICKET_UPDATED = 'ticket:updated',
  TICKET_ASSIGNED = 'ticket:assigned',
  TICKET_STATUS_CHANGED = 'ticket:status-changed',
  COMMENT_ADDED = 'comment:added',
  ATTACHMENT_ADDED = 'attachment:added',
}


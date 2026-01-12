'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSession } from 'next-auth/react'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
})

export function useSocket() {
  return useContext(SocketContext)
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Initialize Socket.IO connection with custom server
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 
                     process.env.NEXT_PUBLIC_APP_URL || 
                     (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3003')
    
    console.log('[Socket.IO] Connecting to:', socketUrl)
    
    const socketInstance = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    socketInstance.on('connect', () => {
      console.log('[Socket.IO] Connected successfully:', socketInstance.id)
      setIsConnected(true)
    })

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket.IO] Disconnected:', reason)
      setIsConnected(false)
    })

    socketInstance.on('connect_error', (error) => {
      console.error('[Socket.IO] Connection error:', error)
      setIsConnected(false)
    })

    setSocket(socketInstance)

    return () => {
      console.log('[Socket.IO] Cleaning up connection')
      socketInstance.disconnect()
    }
  }, [])

  // Join user room when authenticated
  useEffect(() => {
    if (socket && isConnected && session?.user?.id) {
      socket.emit('join-user', session.user.id)
      console.log(`[Socket.IO] Joined user room: user:${session.user.id}`)

      return () => {
        socket.emit('leave-user', session.user.id)
      }
    }
  }, [socket, isConnected, session?.user?.id])

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  )
}


'use client'

import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'
import { SocketProvider } from '@/components/SocketProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SocketProvider>
        {children}
        <Toaster position="top-right" />
      </SocketProvider>
    </SessionProvider>
  )
}


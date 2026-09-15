'use client'

import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'
import { SocketProvider } from '@/components/SocketProvider'
import { ThemeProvider } from '@/components/ThemeProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <SocketProvider>
          {children}
          <Toaster
            position="top-right"
            containerStyle={{ top: '4.5rem' }}
            toastOptions={{
              style: {
                background: 'var(--color-surface)',
                color: 'var(--color-gray-900)',
                border: '1px solid var(--color-gray-200)',
              },
            }}
          />
        </SocketProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}


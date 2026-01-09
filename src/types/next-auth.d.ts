import { Role } from '@/generated/prisma/client'
import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface User {
    id: string
    email: string
    name: string
    role: Role
    department?: string | null
    isKeycloakUser: boolean
  }

  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: Role
      department?: string | null
      isKeycloakUser: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: Role
    department?: string | null
    isKeycloakUser: boolean
  }
}


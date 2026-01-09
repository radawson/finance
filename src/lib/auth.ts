import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import KeycloakProvider from 'next-auth/providers/keycloak'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { Role } from '@/generated/prisma/client'

export const authOptions: NextAuthOptions = {
  providers: [
    // Keycloak OIDC for all users
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_ID!,
      clientSecret: process.env.KEYCLOAK_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
      profile(profile) {
        // Debug: Log the entire profile to see what Keycloak returns
        console.log('Keycloak profile:', JSON.stringify(profile, null, 2))
        
        // Check multiple places where Keycloak might store roles
        const realmRoles = profile.realm_access?.roles || []
        const clientRoles = profile.resource_access?.[process.env.KEYCLOAK_ID!]?.roles || []
        const directRoles = profile.roles || []
        
        // Combine all possible role sources
        const allRoles = [...realmRoles, ...clientRoles, ...directRoles]
        
        console.log('All roles found:', allRoles)
        
        // Check if user has 'admin' role (case-insensitive)
        const isAdmin = allRoles.some(role => 
          role.toLowerCase() === 'admin' || 
          role.toLowerCase() === 'it_admin' ||
          role.toLowerCase() === 'administrator'
        )
        
        console.log('User is admin:', isAdmin)
        
        return {
          id: profile.sub,
          name: profile.name ?? profile.preferred_username,
          email: profile.email,
          role: isAdmin ? Role.ADMIN : Role.USER,
          isKeycloakUser: true,
        }
      },
    }),
    // Credentials for regular users
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.password || user.isKeycloakUser) {
          throw new Error('Invalid credentials')
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)

        if (!isPasswordValid) {
          throw new Error('Invalid credentials')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          isKeycloakUser: user.isKeycloakUser,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Handle Keycloak SSO users
      if (account?.provider === 'keycloak') {
        // Debug: Check if roles are in the access token instead
        console.log('Keycloak access_token (first 50 chars):', account?.access_token?.substring(0, 50))
        console.log('Account object keys:', Object.keys(account || {}))
        
        try {
          const existingUser = await prisma.user.findUnique({
            where: { id: user.id! }, // Use Keycloak sub (UUID) as primary key
          })

          if (!existingUser) {
            // Create new user from Keycloak (role determined by Keycloak roles)
            console.log('Creating new Keycloak user:', user.email, 'Role:', user.role)
            await prisma.user.create({
              data: {
                id: user.id!, // Use Keycloak's sub as ID
                email: user.email!,
                name: user.name || 'User',
                role: user.role as Role,
                isKeycloakUser: true,
              },
            })
            console.log('Keycloak user created successfully')
          } else {
            // Update existing user's role in case it changed in Keycloak
            if (existingUser.role !== user.role) {
              console.log('Updating user role:', existingUser.email, 'from', existingUser.role, 'to', user.role)
              await prisma.user.update({
                where: { id: user.id! },
                data: { role: user.role as Role },
              })
            }
            console.log('Existing Keycloak user logging in:', user.email, 'Role:', user.role)
          }
        } catch (error) {
          console.error('Error in Keycloak signIn callback:', error)
          return false
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        // Use Keycloak's sub (UUID) directly as the ID
        token.id = user.id
        token.role = user.role
        token.isKeycloakUser = user.isKeycloakUser
        token.department = user.department
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
        session.user.isKeycloakUser = token.isKeycloakUser as boolean
        session.user.department = token.department as string | undefined
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
}


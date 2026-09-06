import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import KeycloakProvider from 'next-auth/providers/keycloak'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { Role } from '@/generated/prisma/client'
import { resolveKeycloakRole } from './keycloak-roles'

function roleFromKeycloak(profile: unknown, accessToken?: string | null, idToken?: string | null): Role {
  return resolveKeycloakRole({
    profile: (profile ?? null) as Record<string, unknown> | null,
    accessToken,
    idToken,
  }) as Role
}

export const authOptions: NextAuthOptions = {
  providers: [
    // Keycloak OIDC for all users
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_ID!,
      clientSecret: process.env.KEYCLOAK_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
      profile(profile) {
        // ID token / userinfo usually omit client roles. Final role is resolved
        // from the access token in the signIn and jwt callbacks.
        const userRole = roleFromKeycloak(profile)

        if (process.env.NODE_ENV === 'development') {
          console.log('Keycloak profile:', JSON.stringify(profile, null, 2))
          console.log('Profile-derived role (may be incomplete):', userRole)
        }

        return {
          id: profile.sub,
          name: profile.name ?? profile.preferred_username,
          email: profile.email,
          role: userRole,
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
        const userRole = roleFromKeycloak(profile, account.access_token, account.id_token)
        user.role = userRole

        if (process.env.NODE_ENV === 'development') {
          console.log('Keycloak SSO role from access token:', userRole)
        }

        try {
          const existingUser = await prisma.user.findUnique({
            where: { id: user.id! }, // Use Keycloak sub (UUID) as primary key
          })

          if (!existingUser) {
            if (process.env.NODE_ENV === 'development') {
              console.log('Creating new Keycloak user:', user.email, 'Role:', userRole)
            }
            await prisma.user.create({
              data: {
                id: user.id!, // Use Keycloak's sub as ID
                email: user.email!,
                name: user.name || 'User',
                role: userRole,
                isKeycloakUser: true,
              },
            })
            if (process.env.NODE_ENV === 'development') {
              console.log('Keycloak user created successfully')
            }
          } else {
            // Keep local role in sync with the Keycloak client role
            if (existingUser.role !== userRole) {
              if (process.env.NODE_ENV === 'development') {
                console.log('Updating user role:', existingUser.email, 'from', existingUser.role, 'to', userRole)
              }
              await prisma.user.update({
                where: { id: user.id! },
                data: { role: userRole },
              })
            }
            if (process.env.NODE_ENV === 'development') {
              console.log('Existing Keycloak user logging in:', user.email, 'Role:', userRole)
            }
          }
        } catch (error) {
          console.error('Error in Keycloak signIn callback:', error)
          return false
        }
      }
      return true
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        // Use Keycloak's sub (UUID) directly as the ID
        token.id = user.id
        token.role = user.role
        token.isKeycloakUser = user.isKeycloakUser
        token.department = user.department
      }

      // Client roles live on the access token, not the ID-token profile.
      if (account?.provider === 'keycloak') {
        token.role = roleFromKeycloak(profile, account.access_token, account.id_token)
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


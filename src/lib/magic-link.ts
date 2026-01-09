import { prisma } from './prisma'
import crypto from 'crypto'

const MAGIC_LINK_EXPIRY_HOURS = 72 // 3 days

/**
 * Generates a secure magic token for a user
 */
export function generateMagicToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Creates or updates magic token for a user
 */
export async function createMagicLink(userId: string): Promise<string> {
  const token = generateMagicToken()
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + MAGIC_LINK_EXPIRY_HOURS)

  await prisma.user.update({
    where: { id: userId },
    data: {
      magicToken: token,
      magicTokenExp: expiresAt,
    },
  })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/tickets/view/${token}`
}

/**
 * Validates a magic token and returns the user ID if valid
 */
export async function validateMagicToken(token: string): Promise<string | null> {
  try {
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      console.error('Invalid token provided to validateMagicToken:', token)
      return null
    }

    const user = await prisma.user.findUnique({
      where: { magicToken: token.trim() },
    })

    if (!user) {
      console.log('No user found for magic token')
      return null
    }

    // Check if token is expired
    if (user.magicTokenExp && user.magicTokenExp < new Date()) {
      console.log('Magic token expired for user:', user.id)
      return null
    }

    return user.id
  } catch (error) {
    console.error('Error validating magic token:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    return null
  }
}

/**
 * Invalidates a magic token
 */
export async function invalidateMagicToken(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      magicToken: null,
      magicTokenExp: null,
    },
  })
}


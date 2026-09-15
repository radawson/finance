import { Role } from '@/generated/prisma/client'

export function householdVisibilityWhere(session: { user: { id: string; role: Role } }) {
  if (session.user.role === Role.ADMIN) return {}
  return {
    OR: [{ createdById: session.user.id }, { createdById: null }],
  }
}

export function canViewHouseholdRecord(
  session: { user: { id: string; role: Role } },
  createdById: string | null | undefined,
) {
  if (session.user.role === Role.ADMIN) return true
  return createdById === session.user.id || createdById == null
}

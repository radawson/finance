/** App roles matching the Prisma `Role` enum, kept independent of generated client. */
export type AppRole = 'USER' | 'ADMIN' | 'GUEST'

const ADMIN_ROLE_NAMES = new Set(['admin', 'administrator', 'it_admin'])

type ResourceAccess = Record<string, { roles?: unknown } | undefined>

/**
 * Decode a JWT payload without verifying the signature.
 * Tokens are already validated by the OIDC handshake with Keycloak.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null

    const padded = payload.replace(/-/g, '+').replace(/_/g, '/')
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
    return JSON.parse(Buffer.from(padded + pad, 'base64').toString('utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

/** Keycloak role names are compared in lowercase (`ADMIN` → `admin`). */
function normalizeRoleName(role: string): string {
  return role.trim().toLowerCase()
}

function rolesFromClaim(value: unknown): string[] {
  return asStringArray(value).map(normalizeRoleName).filter(Boolean)
}

function clientRolesFromResourceAccess(
  resourceAccess: ResourceAccess,
  clientKeys: Iterable<string>,
): string[] {
  const byClientLower = new Map(
    Object.entries(resourceAccess).map(([key, value]) => [key.toLowerCase(), value]),
  )

  const roles: string[] = []
  const seenKeys = new Set<string>()

  for (const key of clientKeys) {
    const normalizedKey = key.trim().toLowerCase()
    if (!normalizedKey || seenKeys.has(normalizedKey)) continue
    seenKeys.add(normalizedKey)
    roles.push(...rolesFromClaim(byClientLower.get(normalizedKey)?.roles))
  }

  return roles
}

/**
 * Collect Keycloak roles from ID-token/userinfo claims and/or access-token claims.
 *
 * Client roles (the ones assigned on the OIDC client) live on the access token at
 * `resource_access[clientId].roles`. NextAuth's Keycloak `profile()` callback only
 * receives the ID token / userinfo, which does not include those roles by default.
 */
export function collectKeycloakRoles(
  claimsList: Array<Record<string, unknown> | null | undefined>,
  clientId?: string,
): string[] {
  const roles = new Set<string>()

  for (const claims of claimsList) {
    if (!claims) continue

    const realmAccess = claims.realm_access as { roles?: unknown } | undefined
    for (const role of rolesFromClaim(realmAccess?.roles)) {
      roles.add(role)
    }

    for (const role of rolesFromClaim(claims.roles)) {
      roles.add(role)
    }

    const resourceAccess = claims.resource_access
    if (!resourceAccess || typeof resourceAccess !== 'object') continue

    const clientKeys: string[] = []
    if (clientId) clientKeys.push(clientId)
    if (typeof claims.azp === 'string') clientKeys.push(claims.azp)

    for (const role of clientRolesFromResourceAccess(resourceAccess as ResourceAccess, clientKeys)) {
      roles.add(role)
    }
  }

  return [...roles]
}

export function mapKeycloakRolesToAppRole(roles: string[]): AppRole {
  const normalized = roles.map(normalizeRoleName)

  if (normalized.some((role) => ADMIN_ROLE_NAMES.has(role))) {
    return 'ADMIN'
  }
  if (normalized.some((role) => role === 'guest')) {
    return 'GUEST'
  }
  return 'USER'
}

export function resolveKeycloakRole(params: {
  profile?: Record<string, unknown> | null
  accessToken?: string | null
  idToken?: string | null
  clientId?: string
}): AppRole {
  const clientId = params.clientId ?? process.env.KEYCLOAK_ID
  const claims = [
    params.profile ?? null,
    params.accessToken ? decodeJwtPayload(params.accessToken) : null,
    params.idToken ? decodeJwtPayload(params.idToken) : null,
  ]

  return mapKeycloakRolesToAppRole(collectKeycloakRoles(claims, clientId))
}

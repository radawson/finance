import {
  collectKeycloakRoles,
  decodeJwtPayload,
  mapKeycloakRolesToAppRole,
  resolveKeycloakRole,
} from '../keycloak-roles'

function encodeJwt(payload: Record<string, unknown>): string {
  const json = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `header.${json}.signature`
}

describe('decodeJwtPayload', () => {
  it('decodes a JWT payload', () => {
    const token = encodeJwt({ sub: 'user-1', email: 'a@b.c' })
    expect(decodeJwtPayload(token)).toEqual({ sub: 'user-1', email: 'a@b.c' })
  })

  it('returns null for malformed tokens', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull()
    expect(decodeJwtPayload('')).toBeNull()
  })
})

describe('collectKeycloakRoles', () => {
  it('reads client roles from resource_access using the app client id', () => {
    const roles = collectKeycloakRoles(
      [
        {
          resource_access: {
            'ptx-finance': { roles: ['ADMIN'] },
            account: { roles: ['manage-account'] },
          },
        },
      ],
      'ptx-finance',
    )

    expect(roles).toEqual(['admin'])
  })

  it('normalizes Keycloak ADMIN to lowercase', () => {
    const roles = collectKeycloakRoles(
      [{ resource_access: { 'ptx-finance': { roles: ['ADMIN', 'USER'] } } }],
      'ptx-finance',
    )

    expect(roles).toEqual(expect.arrayContaining(['admin', 'user']))
    expect(roles).not.toContain('ADMIN')
  })

  it('falls back to azp when KEYCLOAK_ID does not match the resource_access key', () => {
    const roles = collectKeycloakRoles(
      [
        {
          azp: 'ptx-finance',
          resource_access: {
            'ptx-finance': { roles: ['ADMIN'] },
          },
        },
      ],
      'wrong-client-id',
    )

    expect(roles).toContain('admin')
  })

  it('includes realm roles, lowercased', () => {
    const roles = collectKeycloakRoles(
      [{ realm_access: { roles: ['offline_access', 'USER'] } }],
      'ptx-finance',
    )

    expect(roles).toEqual(expect.arrayContaining(['offline_access', 'user']))
  })

  it('does not treat other clients’ roles as this app’s roles', () => {
    const roles = collectKeycloakRoles(
      [
        {
          resource_access: {
            'realm-management': { roles: ['realm-admin'] },
            account: { roles: ['manage-account'] },
          },
        },
      ],
      'ptx-finance',
    )

    expect(roles).toEqual([])
  })
})

describe('mapKeycloakRolesToAppRole', () => {
  it('maps admin client role case-insensitively', () => {
    expect(mapKeycloakRolesToAppRole(['admin'])).toBe('ADMIN')
    expect(mapKeycloakRolesToAppRole(['ADMIN'])).toBe('ADMIN')
    expect(mapKeycloakRolesToAppRole(['it_admin'])).toBe('ADMIN')
    expect(mapKeycloakRolesToAppRole(['administrator'])).toBe('ADMIN')
  })

  it('maps guest and defaults to USER', () => {
    expect(mapKeycloakRolesToAppRole(['guest'])).toBe('GUEST')
    expect(mapKeycloakRolesToAppRole(['user'])).toBe('USER')
    expect(mapKeycloakRolesToAppRole([])).toBe('USER')
  })

  it('prefers admin over other roles', () => {
    expect(mapKeycloakRolesToAppRole(['user', 'admin', 'guest'])).toBe('ADMIN')
  })
})

describe('resolveKeycloakRole', () => {
  it('maps Keycloak client role ADMIN from the access token', () => {
    const accessToken = encodeJwt({
      azp: 'ptx-finance',
      resource_access: {
        'ptx-finance': { roles: ['ADMIN'] },
      },
    })

    const role = resolveKeycloakRole({
      clientId: 'ptx-finance',
      profile: { sub: 'user-1', email: 'admin@example.com' },
      accessToken,
    })

    expect(role).toBe('ADMIN')
  })

  it('defaults to USER when no admin client role is present', () => {
    const accessToken = encodeJwt({
      azp: 'ptx-finance',
      resource_access: {
        'ptx-finance': { roles: ['USER'] },
      },
    })

    const role = resolveKeycloakRole({
      clientId: 'ptx-finance',
      profile: { sub: 'user-1' },
      accessToken,
    })

    expect(role).toBe('USER')
  })
})

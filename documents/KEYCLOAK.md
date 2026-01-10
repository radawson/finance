# Keycloak Setup Guide for Kontado

This document provides comprehensive instructions for configuring Keycloak as the SSO (Single Sign-On) provider for Kontado, enabling role-based authentication and user management.

**🎯 Validated for Keycloak 26.2.4** - Your current version

## Overview

Kontado supports dual authentication:
- **Local Credentials**: Traditional email/password login for regular users
- **Keycloak OIDC**: SSO authentication for administrators and IT staff

Keycloak integration provides:
- Centralized user management
- **Client-based role assignment** (per-application roles)
- Single sign-on across applications
- Automatic user provisioning

## Prerequisites

- **Keycloak server version 26.2.4** (currently installed)
- Administrative access to Keycloak admin console
- SSL/TLS configured for production environments
- Java 21+ (required for Keycloak 26.x)

## Quick Setup

### 1. Create Keycloak Client

1. Access your Keycloak admin console (e.g., `https://logon.partridgecrossing.org`)
2. Select your realm (e.g., `ptx`)
3. Navigate to **Clients** → **Create client**

**General Settings (Keycloak 26.x):**
- **Client ID**: `ptx-finance`
- **Client Type**: `OpenID Connect`
- **Client authentication**: `On` (enables confidential client mode)

**Capability config:**
- **Standard flow**: `On`
- **Direct access grants**: `On` (for admin CLI access if needed)

**Login settings:**
- **Valid redirect URIs**: `https://finance.partridgecrossing.org/api/auth/callback/keycloak`
- **Web origins**: `https://finance.partridgecrossing.org`

### 2. Configure Client Credentials

1. Go to **Clients** → **ptx-finance** → **Credentials** tab
2. Copy the **Client secret**
3. Add to your `.env` file:
   ```env
   KEYCLOAK_ID="ptx-finance"
   KEYCLOAK_SECRET="your-client-secret-here"
   KEYCLOAK_ISSUER="https://logon.partridgecrossing.org/realms/ptx"
   ```

### 3. Create Required Client Roles

Since your setup uses **client-specific roles**, create roles within the client:

1. Navigate to **Clients** → **ptx-finance** → **Realm roles** tab
2. Click **Create role** for each role:

| Role Name | Description | Application Role |
|-----------|-------------|------------------|
| `USER` | Regular users with standard access | USER |
| `ADMIN` | Administrators with full access | ADMIN |
| `GUEST` | Limited access users | GUEST |

**Alternative admin role names** (all recognized):
- `it_admin`
- `administrator`
- `admin`

**Note**: Client roles appear in the `resource_access[clientId].roles` section of JWT tokens, not `realm_access.roles`.

### 5. Verify Role Mapping in Client Claims

**Important**: Ensure client roles are included in JWT tokens:

1. Go to **Clients** → **ptx-finance** → **Client scopes** tab
2. Click on the **ptx-finance-dedicated** scope (automatically created)
3. Go to **Protocol mappers** tab
4. Verify **realm roles** mapper exists (should be there by default)
5. If missing, click **Add mapper** → **By configuration** → **User Realm Role**
6. Configure:
   - **Name**: `realm roles`
   - **Mapper Type**: `User Realm Role`
   - **Multivalued**: `On`
   - **Token Claim Name**: `realm_access.roles`
   - **Add to ID token**: `Off` (unless needed)
   - **Add to access token**: `On`

**For Client Roles** (automatically included):
- Client roles are automatically mapped to `resource_access[client_id].roles`
- No additional configuration needed for basic client role mapping

6. **Verify Role Claims in Tokens** (Recommended):
   - Test login after role assignment
   - Check browser dev tools → Network → JWT token response
   - Verify roles appear in `resource_access["ptx-finance"].roles`

### 4. Assign Client Roles to Users

1. Go to **Users** → Select a user
2. Navigate to **Role mapping** tab
3. Click **Assign role** → **Filter by clients** → Select **ptx-finance**
4. Select appropriate client roles (`USER`, `ADMIN`, `GUEST`)
5. Click **Assign**

**Note**: When assigning client roles, make sure to filter by the **ptx-finance** client to see the client-specific roles, not realm roles.

### 5. Configure Environment Variables

Update your production `.env` file:

```env
# Keycloak OIDC - Update with your Keycloak details
KEYCLOAK_ID="ptx-finance"
KEYCLOAK_SECRET="lXRcNij1kKnEd0ulsbZn05LF3IojBbSi"
KEYCLOAK_ISSUER="https://logon.partridgecrossing.org/realms/ptx"

# NextAuth
NEXTAUTH_URL="https://finance.partridgecrossing.org"
NEXTAUTH_SECRET="your-secure-random-secret-here"
```

## Testing Keycloak Integration

### Basic Login Test

1. **Clear browser cookies** for `finance.partridgecrossing.org`
2. Visit your Kontado application
3. Click **"IT Admin Login (SSO)"**
4. Complete Keycloak authentication
5. Verify successful login and correct role assignment

### Log Verification

Check application logs for successful role detection:

```
Keycloak profile: {
  "sub": "user-uuid",
  "email": "user@domain.com",
  "realm_access": {
    "roles": ["USER", "ADMIN"]
  }
}
All roles found: ["USER", "ADMIN"]
User is admin: true
Creating new Keycloak user: user@domain.com Role: ADMIN
```

### Role-Based Access Verification

- **ADMIN users**: Can access all admin features, manage users, view all bills
- **USER users**: Can manage their own bills, access standard features
- **GUEST users**: Limited access (if implemented)

## Advanced Configuration

### Client Scopes (Optional)

Since you're already using client roles, you can further customize with client scopes:

1. Go to **Clients** → **ptx-finance** → **Client scopes**
2. Create client scope (e.g., `kontado-roles`)
3. Add role mappings to the client scope
4. This provides additional granularity beyond basic client roles

### Default Protocol Mappers

**Keycloak 26.x includes these by default** in the `ptx-finance-dedicated` client scope:

- **realm roles**: Maps realm roles to `realm_access.roles`
- **client roles**: Maps client roles to `resource_access[client_id].roles`
- **groups**: Maps user groups
- **username**: Maps username
- **email**: Maps email address

### Custom Protocol Mappers (Optional)

To customize what information is sent in tokens:

1. Go to **Clients** → **ptx-finance** → **Client scopes**
2. Select a scope (or create new)
3. Go to **Protocol mappers** tab
4. Add mappers for additional user attributes

**Common additions:**
- User full name
- Department/organization attributes
- Custom user attributes

### Identity Brokering (Optional)

For integration with external identity providers:

1. Go to **Identity providers**
2. Configure SAML/OIDC providers
3. Set up automatic user federation

## Troubleshooting

### Common Issues

#### 1. "Invalid redirect URI" Error
- Verify **Valid redirect URIs** in client settings
- Ensure HTTPS URLs in production
- Check for trailing slashes

#### 2. Roles Not Detected
- Check user has **client roles** assigned in Keycloak (not realm roles)
- Verify role names match expected values
- **Check protocol mappers**: Ensure roles are included in JWT claims
  - Go to **Clients** → **ptx-finance** → **Client scopes** → **ptx-finance-dedicated** → **Protocol mappers**
  - Verify `realm roles` mapper exists and is configured to add to access tokens
- Check browser developer tools → Network → Keycloak token response
- Look for `resource_access["ptx-finance"].roles` in the JWT payload (client roles)
- If using realm roles instead, check `realm_access.roles`
- **Decode JWT**: Use https://jwt.io to inspect token contents

#### 2.5 Role Not Updating After Assignment
- **Session Caching**: NextAuth caches user sessions - role changes require fresh login
- **Force Logout**: Clear browser cookies completely for the application
- **Check Database**: Verify role was updated in the database after login
- **Debug Logs**: Check application logs for role detection during login
- **JWT Expiry**: Wait for token to expire or force re-authentication

#### 3. "Client not found" Error
- Verify **Client ID** matches exactly
- Check realm selection in admin console
- Ensure client is enabled
- In Keycloak 26.x: Check "Client authentication" is set to "On" for confidential clients

#### 4. SSL/HTTPS Issues
- Keycloak must use HTTPS in production
- Verify SSL certificates are valid
- Check firewall allows HTTPS traffic

### Debug Steps

1. **Check Token Content**:
   ```bash
   # Decode JWT token from browser dev tools
   # Look for 'resource_access.ptx-finance.roles' (client roles) or 'realm_access.roles'
   ```

2. **Test JWT Token Decoding**:
   ```bash
   # Copy access token from browser dev tools
   # Decode at https://jwt.io
   # Check payload for role claims
   ```

3. **Verify Protocol Mappers**:
   - Go to **Clients** → **ptx-finance** → **Client scopes** → **ptx-finance-dedicated**
   - Check **Protocol mappers** tab
   - Ensure role mappers are present and enabled

4. **Test Keycloak Configuration**:
   ```bash
   # Test OIDC discovery endpoint
   curl https://logon.partridgecrossing.org/realms/ptx/.well-known/openid-connect-configuration
   ```

5. **Verify Client Settings**:
   - Client ID matches exactly
   - Client secret is correct
   - Redirect URIs are properly configured
   - Client is enabled
   - **Client authentication**: Set to "On" for confidential clients

### Application Logs

Enable debug logging by adding to your environment:
```env
DEBUG=true
NODE_ENV=development
```

## Security Considerations

### Production Checklist

- [ ] Use HTTPS for all Keycloak URLs
- [ ] Set strong client secrets
- [ ] Configure proper session timeouts
- [ ] Enable brute force protection
- [ ] Set up proper CORS policies
- [ ] Configure token lifetimes appropriately
- [ ] Enable audit logging

### Best Practices

1. **Use Realm Roles** for application-level permissions
2. **Regularly rotate** client secrets
3. **Monitor login attempts** and failed authentications
4. **Configure session limits** to prevent abuse
5. **Use groups** for organizing users by department/team

## Role Mapping Reference

### How Roles Are Mapped

Since you're using **client roles**, the application checks for roles in this order:

1. `profile.resource_access["ptx-finance"].roles` (your client roles) - **PRIMARY**
2. `profile.realm_access.roles` (realm roles)
3. `profile.roles` (direct assignment)

**Expected JWT token structure for client roles:**
```json
{
  "resource_access": {
    "ptx-finance": {
      "roles": ["ADMIN", "USER"]
    }
  }
}
```

### Log Verification

Check application logs for successful client role detection:

```
Keycloak profile: {
  "sub": "user-uuid",
  "resource_access": {
    "ptx-finance": {
      "roles": ["ADMIN"]
    }
  }
}
All roles found: ["ADMIN"]
User is admin: true
Creating new Keycloak user: user@domain.com Role: ADMIN
```

### Role Name Recognition

**Role Assignment Priority** (case-insensitive):
1. **ADMIN** if user has: `admin`, `administrator`, `it_admin`
2. **GUEST** if user has: `guest`
3. **USER** if user has: `user` or any other role
4. **USER** (default) if no roles assigned

**Note**: Roles are checked in priority order - admin roles take precedence over guest, which takes precedence over user.

### Automatic User Creation

When a user logs in via Keycloak:
1. Application checks if user exists in database
2. If not, creates user with Keycloak `sub` as ID
3. Assigns role based on Keycloak roles
4. Updates role on subsequent logins if changed

## Migration from Local Users

If migrating existing users to Keycloak:

1. **Export user data** from local database
2. **Create users in Keycloak** with same email addresses
3. **Assign appropriate roles** in Keycloak
4. **Update application** to use Keycloak IDs
5. **Test authentication flow**

## Support

For Keycloak-specific issues:
- Check Keycloak server logs
- Verify network connectivity
- Test with Keycloak admin CLI
- Review Keycloak documentation

For application-specific issues:
- Check Kontado application logs
- Verify environment variables
- Test local authentication still works
- Review NextAuth.js documentation

## Keycloak 26.x Notes

Keycloak 26.x includes several UI and configuration changes:

### Admin Console Changes
- **Client creation**: Uses "General settings" instead of "Basic settings"
- **Client authentication**: Explicitly enable for confidential clients
- **Role assignment**: Streamlined role mapping interface

### Performance Improvements
- Better token caching
- Improved session management
- Enhanced metrics and monitoring

### Security Enhancements
- Updated cryptographic algorithms
- Improved token validation
- Better audit logging

### Migration Notes
If upgrading from earlier versions:
1. Back up your realm configuration
2. Test client configurations after upgrade
3. Verify role mappings are preserved
4. Check custom protocol mappers still work

---

**Document Version**: 1.3
**Last Updated**: January 2026
**Compatible with**: Keycloak 26.x (client roles), Kontado v1.0+
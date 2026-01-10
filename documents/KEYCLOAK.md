# Keycloak Setup Guide for Kontado

This document provides comprehensive instructions for configuring Keycloak as the SSO (Single Sign-On) provider for Kontado, enabling role-based authentication and user management.

**🎯 Validated for Keycloak 26.2.4** - Your current version

## Overview

Kontado supports dual authentication:
- **Local Credentials**: Traditional email/password login for regular users
- **Keycloak OIDC**: SSO authentication for administrators and IT staff

Keycloak integration provides:
- Centralized user management
- Role-based access control
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

### 3. Create Required Roles

1. Navigate to **Realm Settings** → **Roles**
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

### 4. Assign Roles to Users

1. Go to **Users** → Select a user
2. Navigate to **Role mapping** tab
3. Click **Assign role**
4. Select appropriate roles
5. Click **Assign**

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

For more granular role management, you can use client-specific roles:

1. Go to **Clients** → **ptx-finance** → **Client scopes**
2. Create client scope (e.g., `kontado-roles`)
3. Add role mappings to the client scope
4. Assign client roles to users instead of realm roles

### Protocol Mappers (Optional)

To customize what information is sent in tokens:

1. Go to **Clients** → **ptx-finance** → **Client scopes**
2. Select a scope (or create new)
3. Go to **Protocol mappers** tab
4. Add mappers for additional user attributes

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
- Check user has roles assigned in Keycloak
- Verify role names match expected values
- Check browser developer tools → Network → Keycloak token response
- Look for `realm_access.roles` in the JWT payload

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
   # Look for 'realm_access', 'resource_access', or direct 'roles'
   ```

2. **Test Keycloak Configuration**:
   ```bash
   # Test OIDC discovery endpoint
   curl https://logon.partridgecrossing.org/realms/ptx/.well-known/openid-connect-configuration
   ```

3. **Verify Client Settings**:
   - Client ID matches exactly
   - Client secret is correct
   - Redirect URIs are properly configured
   - Client is enabled

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

The application checks for roles in this order:

1. `profile.realm_access.roles` (recommended)
2. `profile.resource_access[clientId].roles` (client-specific)
3. `profile.roles` (direct assignment)

### Role Name Recognition

**Admin Roles** (case-insensitive):
- `admin`
- `administrator`
- `it_admin`

**User Roles**:
- `user`
- `default-roles-ptx` (Keycloak default)

**Guest Roles**:
- `guest`

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

**Document Version**: 1.1
**Last Updated**: January 2026
**Compatible with**: Keycloak 26.x, Kontado v1.0+
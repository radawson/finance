# Kontado API Reference

## Vendor Endpoints

### Public Endpoints (No Authentication Required)

#### GET /api/vendors/public
Returns a list of vendors that have been used in bills (including anonymous bills).

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Vendor Name"
  }
]
```

**Notes:**
- Only returns vendors that have been used in at least one bill
- Returns only `id` and `name` fields
- No accounts, contact information, or sensitive data included
- Suitable for anonymous bill entry forms

#### GET /api/vendors/public/[id]
Returns a single vendor by ID (public access, no accounts).

**Response:**
```json
{
  "id": "uuid",
  "name": "Vendor Name"
}
```

**Notes:**
- Returns only `id` and `name` fields
- No accounts, contact information, or sensitive data included
- Returns 404 if vendor not found

### Authenticated Endpoints (Requires Login)

#### GET /api/vendors
Returns all vendors with accounts filtered by user's bill ownership.

**Authentication:** Required

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Vendor Name",
    "email": "vendor@example.com",
    "phone": "+1234567890",
    "address": "123 Main St",
    "city": "City",
    "state": "State",
    "zip": "12345",
    "country": "USA",
    "website": "https://vendor.com",
    "description": "Vendor description",
    "createdById": "uuid",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "createdBy": {
      "id": "uuid",
      "name": "Creator Name"
    },
    "accounts": [
      {
        "id": "uuid",
        "vendorId": "uuid",
        "accountNumber": "****1234",
        "accountTypeId": "uuid",
        "nickname": "Primary Account",
        "notes": "Account notes",
        "isActive": true,
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z",
        "type": {
          "id": "uuid",
          "name": "Account Type"
        }
      }
    ],
    "_count": {
      "bills": 5
    }
  }
]
```

**Notes:**
- Returns all vendors (vendors are global)
- Accounts are filtered to only show those used in bills created by the authenticated user
- Full vendor information included

#### GET /api/vendors/[id]
Returns a single vendor with all active accounts.

**Authentication:** Required

**Response:**
```json
{
  "id": "uuid",
  "name": "Vendor Name",
  "email": "vendor@example.com",
  "phone": "+1234567890",
  "address": "123 Main St",
  "city": "City",
  "state": "State",
  "zip": "12345",
  "country": "USA",
  "website": "https://vendor.com",
  "description": "Vendor description",
  "createdById": "uuid",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z",
  "createdBy": {
    "id": "uuid",
    "name": "Creator Name"
  },
  "accounts": [
    {
      "id": "uuid",
      "vendorId": "uuid",
      "accountNumber": "****1234",
      "accountTypeId": "uuid",
      "nickname": "Primary Account",
      "notes": "Account notes",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z",
      "type": {
        "id": "uuid",
        "name": "Account Type"
      }
    }
  ],
  "_count": {
    "bills": 5
  }
}
```

**Notes:**
- Returns all active accounts for the vendor (not filtered by user)
- Users can see all accounts but can only edit/delete accounts they've used in bills
- Full vendor information included
- Returns 404 if vendor not found
- Returns 401 if not authenticated

### Vendor Account Endpoints

#### GET /api/vendors/[id]/accounts
Returns all active accounts for a vendor.

**Authentication:** Required

**Response:**
```json
[
  {
    "id": "uuid",
    "vendorId": "uuid",
    "accountNumber": "****1234",
    "accountTypeId": "uuid",
    "nickname": "Primary Account",
    "notes": "Account notes",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "type": {
      "id": "uuid",
      "name": "Account Type"
    }
  }
]
```

**Notes:**
- Returns all active accounts (not filtered by user)
- Users can see all accounts but can only edit/delete accounts they've used in bills

#### POST /api/vendors/[id]/accounts
Creates a new account for a vendor.

**Authentication:** Required

**Request Body:**
```json
{
  "accountNumber": "1234567890",
  "accountTypeId": "uuid",
  "nickname": "Primary Account",
  "notes": "Account notes",
  "isActive": true
}
```

**Response:** 201 Created with account object

**Notes:**
- Any authenticated user can create accounts for any vendor
- Emits WebSocket event `vendor:account:created` to `vendor:{id}` room

#### PATCH /api/vendors/[id]/accounts/[accountId]
Updates a vendor account.

**Authentication:** Required

**Request Body:**
```json
{
  "accountNumber": "1234567890",
  "accountTypeId": "uuid",
  "nickname": "Primary Account",
  "notes": "Account notes",
  "isActive": true
}
```

**Response:** Updated account object

**Notes:**
- Users can only edit accounts they've used in bills (or admins can edit any)
- Emits WebSocket event `vendor:account:updated` to `vendor:{id}` room

#### DELETE /api/vendors/[id]/accounts/[accountId]
Soft deletes a vendor account (sets `isActive` to false).

**Authentication:** Required

**Response:** 200 OK with success message

**Notes:**
- Users can only delete accounts they've used in bills (or admins can delete any)
- Emits WebSocket event `vendor:account:deleted` to `vendor:{id}` room

## WebSocket Events

### Vendor Account Events

All vendor account events are emitted to the `vendor:{vendorId}` room.

- `vendor:account:created` - Emitted when an account is created
- `vendor:account:updated` - Emitted when an account is updated
- `vendor:account:deleted` - Emitted when an account is deleted

Clients should join the vendor room when viewing a vendor detail page:
```javascript
socket.emit('join', `vendor:${vendorId}`)
```

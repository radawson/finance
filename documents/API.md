# Kontado API Reference

## Authentication

Most endpoints require authentication via NextAuth session. Endpoints marked **Public** do not require authentication.

**Authentication Methods:**
- Local credentials (email/password)
- Keycloak OIDC (SSO for admins)

**Roles:** `USER`, `ADMIN`, `GUEST`

---

## Bill Endpoints

### GET /api/bills
Returns bills visible to the authenticated user, ordered by due date ascending.

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `PREDICTED`, `PENDING`, `DUE_SOON`, `OVERDUE`, `PAID`, `SKIPPED` |
| `categoryId` | UUID | Filter by category |
| `vendorId` | UUID | Filter by vendor |
| `isRecurring` | boolean | Filter recurring bills |
| `tags` | string | Comma-separated tags (bills must contain ALL specified tags) |
| `includePredicted` | boolean | Include PREDICTED bills (excluded by default) |

**Notes:**
- Non-admin users see their own bills plus unassigned bills (`createdById = null`)
- Admin users see all bills
- PREDICTED bills are excluded by default unless `includePredicted=true` or a specific status is requested

### POST /api/bills
Creates a new bill.

**Authentication:** Required

**Request Body:**
```json
{
  "title": "Electric Bill",
  "amount": 150.00,
  "dueDate": "2026-02-15T00:00:00Z",
  "categoryId": "uuid",
  "description": "January electricity",
  "vendorId": "uuid",
  "vendorAccountId": "uuid",
  "status": "PENDING",
  "paidDate": null,
  "isRecurring": false,
  "invoiceNumber": "INV-2026-001",
  "tags": ["utilities", "monthly"],
  "updateAccountBalance": false
}
```

**Required Fields:** `title`, `amount`, `dueDate`, `categoryId`

**Response:** 201 Created with full bill object

**Notes:**
- Status is auto-calculated from due date if not provided
- Tags are trimmed and limited to 128 characters each
- If `updateAccountBalance` is true, the vendor account balance is updated and a snapshot is recorded
- Emits WebSocket event `bill:created` to all clients

### POST /api/bills/anonymous
Creates a bill without authentication (anonymous entry).

**Authentication:** Not required

**Request Body:**
```json
{
  "title": "Electric Bill",
  "amount": 150.00,
  "dueDate": "2026-02-15T00:00:00Z",
  "categoryId": "uuid",
  "description": "Optional description",
  "vendorId": "uuid",
  "vendorAccountId": "uuid",
  "invoiceNumber": "INV-2026-001"
}
```

**Required Fields:** `title`, `amount`, `dueDate`, `categoryId`

**Response:** 201 Created with bill object

**Notes:**
- Bill is created with `createdById = null` (unassigned)
- Unassigned bills are visible to all authenticated users
- Any authenticated user can later claim an unassigned bill by editing it

### GET /api/bills/[id]
Returns a single bill with full details including comments and attachments.

**Authentication:** Required (or anonymous access for unassigned bills)

**Response:** Full bill object with category, vendor, vendor account, comments, attachments, recurrence pattern, and counts.

**Notes:**
- Users can access bills they created or unassigned bills
- Admin users can access any bill
- Returns 404 if bill not found
- Returns 403 if user lacks permission

### PATCH /api/bills/[id]
Updates a bill.

**Authentication:** Required

**Request Body:** Any subset of bill fields (same as POST, all optional)

**Notes:**
- Status is auto-recalculated when `dueDate` or `paidDate` changes
- PREDICTED bills auto-transition to PENDING when edited (actualization)
- Prediction metadata (`predictionConfidence`, `predictionMethod`) is cleared on actualization
- Unassigned bills are auto-assigned to the editing user
- Tracks field changes and creates notifications for the bill owner if changed by another user
- Emits WebSocket event `bill:updated` to `bill:{id}` room
- Emits `notification:new` to bill owner's `user:{userId}` room when changed by another user

### DELETE /api/bills/[id]
Deletes a bill.

**Authentication:** Required (admin or bill creator only)

**Response:** `{ "message": "Bill deleted successfully" }`

**Notes:**
- Only admin users or the bill creator can delete
- Emits WebSocket event `bill:deleted` to `bill:{id}` room

### GET /api/bills/predicted
Generates and returns predicted bills for the next 30 days.

**Authentication:** Required

**Response:** Array of predicted bill objects with status `PREDICTED`

**Notes:**
- Predicted bills are real Bill records that can be clicked and updated when the actual bill arrives
- Idempotent: running multiple times does not create duplicates
- Uses the prediction algorithm described in DESIGN.md

### Bill Sub-Resources

#### GET /api/bills/[id]/comments
Returns all comments for a bill, ordered by creation date descending.

#### POST /api/bills/[id]/comments
Adds a comment to a bill. Can be anonymous or authenticated.

**Request Body:**
```json
{
  "content": "Comment text"
}
```

#### DELETE /api/bills/[id]/comments/[commentId]
Deletes a comment (creator or admin only).

#### GET /api/bills/[id]/attachments
Returns all attachments for a bill.

#### POST /api/bills/[id]/attachments
Uploads a file attachment to a bill (multipart form data).

#### DELETE /api/bills/[id]/attachments/[attachmentId]
Deletes an attachment (creator or admin only).

#### GET /api/bills/[id]/recurrence
Returns the recurrence pattern for a bill.

#### POST /api/bills/[id]/recurrence
Creates or updates a recurrence pattern for a bill.

**Request Body:**
```json
{
  "frequency": "MONTHLY",
  "dayOfMonth": 15,
  "startDate": "2026-01-15T00:00:00Z",
  "endDate": null
}
```

**Frequency Options:** `MONTHLY`, `QUARTERLY`, `BIANNUALLY`, `YEARLY`

---

## Vendor Endpoints

### Public Endpoints (No Authentication Required)

#### GET /api/vendors/public
Returns a list of vendors that have been used in bills.

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
    "addressLine2": "Suite 100",
    "city": "City",
    "state": "State",
    "zip": "12345",
    "country": "USA",
    "website": "https://vendor.com",
    "description": "Vendor description",
    "tags": ["utilities", "monthly"],
    "createdById": "uuid",
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z",
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
        "balance": "1500.00",
        "interestRate": "19.99",
        "nickname": "Primary Account",
        "notes": "Account notes",
        "isActive": true,
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-01-01T00:00:00Z",
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

**Notes:**
- Returns all active accounts for the vendor (not filtered by user)
- Users can see all accounts but can only edit/delete accounts they've used in bills
- Returns 404 if vendor not found

### Vendor Account Endpoints

#### GET /api/vendors/[id]/accounts
Returns all active accounts for a vendor.

**Authentication:** Required

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

**Notes:**
- Users can only edit accounts they've used in bills (or admins can edit any)
- Emits WebSocket event `vendor:account:updated` to `vendor:{id}` room

#### DELETE /api/vendors/[id]/accounts/[accountId]
Soft deletes a vendor account (sets `isActive` to false).

**Authentication:** Required

**Notes:**
- Users can only delete accounts they've used in bills (or admins can delete any)
- Emits WebSocket event `vendor:account:deleted` to `vendor:{id}` room

---

## Category Endpoints

### GET /api/categories
Returns global categories and the authenticated user's custom categories.

**Authentication:** Optional (returns only global categories if unauthenticated)

### POST /api/categories
Creates a user-specific category.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "Category Name",
  "description": "Optional description",
  "color": "#ff6600"
}
```

### PATCH /api/categories/[id]
Updates a category.

**Authentication:** Required

### DELETE /api/categories/[id]
Deletes a category (only user-created categories, not global ones).

**Authentication:** Required

---

## Analysis Endpoints

### GET /api/analysis/history
Returns historic paid bills grouped by period.

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `period` | string | `monthly` (default), `quarterly`, `yearly`, `custom` |
| `startDate` | ISO date | Filter start date (by `paidDate`) |
| `endDate` | ISO date | Filter end date (by `paidDate`) |

**Response:**
```json
{
  "period": "monthly",
  "data": [
    {
      "periodLabel": "Jan 2026",
      "totalAmount": 1250.00,
      "billCount": 5,
      "bills": [...]
    }
  ]
}
```

### GET /api/analysis/budget
Returns budget predictions based on recurring bill patterns.

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `period` | string | `monthly` (default), `quarterly`, `yearly`, `custom` |
| `startDate` | ISO date | Prediction start date (default: now) |
| `endDate` | ISO date | Prediction end date (default: 1 year from now) |
| `includeHistoric` | boolean | Include historical data alongside predictions |

**Response:**
```json
{
  "period": "monthly",
  "predictions": [...],
  "historicData": [...]
}
```

### GET /api/analysis/vendor-trends
Returns spending trends for selected vendors grouped by period.

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `vendorIds` | string | **Required.** Comma-separated vendor UUIDs |
| `period` | string | `monthly` (default), `quarterly`, `yearly`, `custom` |
| `startDate` | ISO date | Filter start date |
| `endDate` | ISO date | Filter end date |

**Response:**
```json
{
  "period": "monthly",
  "vendors": [
    {
      "vendorId": "uuid",
      "vendorName": "Electric Company",
      "periods": [
        {
          "periodLabel": "Jan 2026",
          "totalAmount": 250.00,
          "billCount": 1
        }
      ]
    }
  ]
}
```

### GET /api/analysis/credit-card-balances
Returns balance snapshot history for accounts that have balance data.

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `period` | string | `3m`, `6m` (default), `1y` |

**Response:**
```json
{
  "period": "6m",
  "accounts": [
    {
      "accountId": "uuid",
      "accountLabel": "Primary Card",
      "vendorName": "Bank Name",
      "accountTypeName": "Credit Card",
      "currentBalance": "1500.00",
      "interestRate": "19.99",
      "snapshots": [
        {
          "date": "2026-01-15T00:00:00Z",
          "balance": "1500.00"
        }
      ]
    }
  ]
}
```

---

## Stats Endpoint

### GET /api/stats
Returns dashboard statistics for the authenticated user.

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `categoryPeriod` | string | `week`, `month` (default), `quarter`, `year` |

**Response includes:**
- Bill counts by status (total, pending, dueSoon, overdue, paid, skipped, predicted, missing)
- Upcoming bills (7 and 30 day windows)
- Category breakdown (actual and projected)
- Recent bills and overdue bills lists
- Predicted bills list

---

## Notification Endpoints

### GET /api/notifications
Returns the authenticated user's notifications (up to 50, unread first).

**Authentication:** Required

### POST /api/notifications
Creates a notification (admin only, for testing).

**Authentication:** Required (ADMIN role)

**Request Body:**
```json
{
  "userId": "uuid",
  "type": "bill_updated",
  "title": "Bill Updated",
  "message": "Your bill was updated",
  "billId": "uuid"
}
```

**Notification Types:** `bill_assigned`, `bill_updated`, `bill_comment`, `bill_attachment`

### PATCH /api/notifications/[id]
Marks a notification as read.

**Authentication:** Required

### DELETE /api/notifications/[id]
Deletes a notification.

**Authentication:** Required

---

## Dashboard Endpoints

### GET /api/dashboard/prefs
Returns the authenticated user's dashboard layout preferences and visible widget IDs. Returns `null` if no preferences have been saved.

**Authentication:** Required

**Response:**
```json
{
  "layouts": {
    "lg": [
      { "i": "stats", "x": 0, "y": 0, "w": 12, "h": 2 },
      { "i": "upcoming-bills", "x": 0, "y": 2, "w": 6, "h": 4 }
    ],
    "md": [],
    "sm": [],
    "xs": []
  },
  "visibleWidgetIds": ["stats", "upcoming-bills", "overdue-bills", "category-breakdown"]
}
```

**Notes:**
- Returns `null` (not 404) if the user has not saved any preferences yet
- Layout keys correspond to responsive breakpoints (`lg`, `md`, `sm`, `xs`)

### PATCH /api/dashboard/prefs
Creates or updates the authenticated user's dashboard preferences (upsert).

**Authentication:** Required

**Request Body:**
```json
{
  "layouts": {
    "lg": [
      { "i": "stats", "x": 0, "y": 0, "w": 12, "h": 2 }
    ]
  },
  "visibleWidgetIds": ["stats", "upcoming-bills", "overdue-bills"]
}
```

**Notes:**
- Both `layouts` and `visibleWidgetIds` are optional; only provided fields are updated
- Widget IDs are validated against the known set: `stats`, `expected-bills`, `credit-card`, `upcoming-bills`, `overdue-bills`, `category-breakdown`, `recent-bills`
- Returns 400 if no fields are provided or widget IDs are invalid

---

## Account Type Endpoints

### GET /api/account-types
Returns all account types.

**Authentication:** Required

### POST /api/account-types
Creates a new account type.

**Authentication:** Required (ADMIN role)

### PATCH /api/account-types/[id]
Updates an account type.

**Authentication:** Required (ADMIN role)

### DELETE /api/account-types/[id]
Deletes an account type.

**Authentication:** Required (ADMIN role)

---

## User Endpoints

### GET /api/users
Returns all users (admin only).

**Authentication:** Required (ADMIN role)

### POST /api/auth/register
Registers a new user account.

**Request Body:**
```json
{
  "name": "User Name",
  "email": "user@example.com",
  "password": "password123",
  "department": "Engineering"
}
```

---

## Other Endpoints

### GET /api/version
Returns the application version from `package.json`.

### GET /api/init
Initializes seed data (categories, admin user) if the database is empty.

---

## WebSocket Events

All real-time events are emitted via Socket.IO on the same port as the HTTP server (default 3003).

### Bill Events

| Event | When | Sent To | Data |
|-------|------|---------|------|
| `bill:created` | New bill created | All clients | `{ bill, createdBy }` |
| `bill:updated` | Bill updated | `bill:{billId}` room | `{ bill, changedBy }` |
| `bill:deleted` | Bill deleted | `bill:{billId}` room | `{ id }` |

### Vendor Account Events

All vendor account events are emitted to the `vendor:{vendorId}` room.

| Event | When | Data |
|-------|------|------|
| `vendor:account:created` | Account created | Account object |
| `vendor:account:updated` | Account updated | Updated account object |
| `vendor:account:deleted` | Account deleted | `{ id, vendorId }` |

### Notification Events

| Event | When | Sent To | Data |
|-------|------|---------|------|
| `notification:new` | Notification created | `user:{userId}` room | Notification with `billTitle` and `createdBy` |

### Room Management

Clients join rooms by emitting events:

```javascript
// Join a bill room (for bill detail page)
socket.emit('join', `bill:${billId}`)

// Join a vendor room (for vendor detail page)
socket.emit('join', `vendor:${vendorId}`)

// Join user notification room (automatic via SocketProvider)
socket.emit('join-user', userId)
```

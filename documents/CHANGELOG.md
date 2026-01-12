# Changelog

All notable changes to Kontado will be documented in this file.

## [Unreleased]

### Added

- **Analysis Tab**: New Analysis feature with two views:
  - Historic Bills Paid: View expense history grouped by period (monthly, quarterly, yearly, or custom date range)
  - Periodic Budget: View budget predictions based on recurrence patterns
  - Export functionality: Download or print analysis reports as Markdown files
- **Invoice Number Field**: Optional `invoiceNumber` field added to bills for tracking vendor invoice numbers
  - Available in bill creation and edit forms
  - Displayed in bill view modal, bill cards, and bills table
  - Optional field - no uniqueness constraint
- **Vendor Trends Tab**: New analysis view showing spending trends for selected vendors across specified periods
  - Custom SVG charts (line and bar views)
  - Searchable multi-select vendor selector
  - Supports 1 to n vendors with distinct color coding
- **Phone Number Formatting**: Intelligent phone number input and display formatting
  - Auto-formats phone numbers to `+1 (XXX) XXX-XXXX` for display
  - Accepts various input formats (10 digits, formatted numbers, etc.)
  - Automatically adds `+1` country code by default (US/Canada)
  - Stores phone numbers in E.164 format (`+1XXXXXXXXXX`) for consistency
  - Smart cursor management during input
  - Applied to vendor creation and edit forms
- **Quick Mark as Paid**: One-click button in Bill view modal to mark bills as paid
  - Sets paid date to current date automatically
  - Only visible for unpaid bills
  - Updates parent components (dashboard, bills list) automatically
  - Custom paid dates still available via Edit page
- **Category Pie Chart**: Visual category breakdown on dashboard
  - Custom SVG donut chart replacing list view
  - Shows category names, amounts, counts, and percentages
  - Uses category colors when available
  - Interactive legend with hover effects
- **Notification Center**: Real-time notification system (v0.2.1)
  - Bell icon in navbar with unread count badge
  - Notifications for bill assignment and changes by other users
  - Database schema and API endpoints for notification management
  - GUI elements created and tested

### Changed

- Analysis tab added to main navigation
- **Vendor Structure**: Vendors are now global/shared resources
  - Any authenticated user can create or edit vendors
  - `createdById` field kept for audit purposes only (not used for authorization)
  - Vendor accounts remain user-specific (filtered by bill ownership)
  - Public endpoint (`/api/vendors/public`) returns vendor names only (no account numbers)
- **Dashboard Category Display**: Replaced category breakdown list with interactive pie chart
  - Better visual representation of spending by category
  - Category colors now included in API response
- **Vendor Phone Numbers**: Phone numbers now automatically formatted for display
  - Existing phone numbers in database are automatically formatted when displayed
  - No database migration required (stored as strings)

### Technical

- Added `/api/analysis/history` endpoint for historic bills analysis
- Added `/api/analysis/budget` endpoint for budget predictions
- Added `/api/analysis/vendor-trends` endpoint for vendor spending trends
- **Vendor API Endpoints**:
  - `/api/vendors/public` - Public endpoint for vendor list (id, name only, no accounts)
  - `/api/vendors/public/[id]` - Public endpoint for single vendor (id, name only, no accounts)
  - `/api/vendors` - Authenticated endpoint for vendor list with accounts (filtered by user's bill ownership)
  - `/api/vendors/[id]` - Authenticated endpoint for single vendor with all accounts
- **Notification API Endpoints** (v0.2.1):
  - `/api/notifications` - GET (fetch user notifications) and POST (create notification, admin-only)
  - `/api/notifications/[id]` - PATCH (mark as read) and DELETE (delete notification)
- Database schema updated to include `invoiceNumber` field on `Bill` model
- Database schema updated to include `Notification` model (v0.2.1)
- Type definitions updated to include `invoiceNumber` in `Bill` interface
- Type definitions updated to include `Notification` interface and `color` in `DashboardStats.categoryBreakdown`
- Vendor API routes updated to remove ownership-based authorization checks
- Vendor account filtering now based on bill ownership (proxy for account ownership)
- Real-time WebSocket updates for vendor accounts (created/updated/deleted events)
- Real-time WebSocket updates for bills (created/updated/deleted events)
- WebSocket events for notifications (`NOTIFICATION_NEW`)
- **Phone Number Utilities**:
  - `normalizePhoneInput()` - Extracts digits and handles country codes
  - `formatPhoneForDisplay()` - Formats to `+1 (XXX) XXX-XXXX`
  - `formatPhoneForStorage()` - Converts to E.164 format
  - `isValidPhoneNumber()` - Basic validation
  - `PhoneInput` React component with auto-formatting and cursor management
- **Bill Status Updates**:
  - `BillViewModal` now supports `onUpdate` callback for parent component refresh
  - PATCH `/api/bills/[id]` supports quick status updates with automatic date handling

## Notes

- Historical pattern analysis for bills without explicit recurrence is planned for future implementation
- Invoice number field is optional and does not enforce uniqueness

# Changelog

All notable changes to Kontado will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.6] - 2026-02-12

### Added

- **Predicted Bills**: Intelligent bill prediction system that generates upcoming bills based on recurring patterns
  - New `PREDICTED` bill status for system-generated predictions
  - `GET /api/bills/predicted` endpoint generates predicted bills for the next 30 days
  - Predicted bills are real Bill records that can be clicked and actualized when the actual bill arrives
  - Prediction metadata: `templateBillId`, `predictionConfidence` (0.00-1.00), `predictionMethod` (trend/weighted/seasonal/average/synthetic)
  - Auto-transition from PREDICTED to PENDING when a predicted bill is edited
  - Prediction metadata is cleared on actualization
  - Dashboard shows predicted bills count and "missing" (past-due predicted) bills count
  - Business logic in `prediction-generator.ts` and `recurring-bills.ts`
- **Balance Snapshots**: Track vendor account balances over time
  - New `VendorAccountBalanceSnapshot` model with `accountId`, `balance`, `recordedAt`
  - Snapshots recorded automatically when account balances change (bill creation/update with `updateAccountBalance`)
  - `GET /api/analysis/credit-card-balances` endpoint returns snapshot history (period: 3m, 6m, 1y)
  - `CreditCardBalanceGraph` component for visualizing balance trends
- **VendorAccount balance and interestRate fields**: Added `balance` (Decimal) and `interestRate` (Decimal) to vendor accounts for financial tracking
- **Projected Category Breakdown**: Dashboard now shows projected spending to end of period based on actual future bills and predictions

### Changed

- Stats API (`/api/stats`) now excludes PREDICTED bills from main counts and includes separate `predictedBills` and `missingBills` counts
- Bills API (`GET /api/bills`) excludes PREDICTED bills by default; use `includePredicted=true` to include them
- PATCH `/api/bills/[id]` now supports PREDICTED -> actual transition (actualization) with automatic status calculation

### Database Migrations

- `20260212132951_add_balance_snapshots` - VendorAccountBalanceSnapshot model, balance/interestRate on VendorAccount
- `20260212134514_add_predicted_bills` - templateBillId, predictionConfidence, predictionMethod on Bill

## [0.2.5] - 2026-01-13

### Added

- **Tags**: String array tags on both Bill and Vendor models
  - Max 128 characters per tag
  - Bills can be filtered by tags (comma-separated, must contain ALL specified tags)
  - `TagInput` and `TagDisplay` components for tag management in forms
  - Tags stored as PostgreSQL string arrays

### Database Migrations

- `20260113180322_add_tags_to_bills_and_vendors` - tags array field on Bill and Vendor

## [0.2.4] - 2026-01-12

### Added

- **Category Management**: Create and manage custom bill categories
  - Category CRUD endpoints (`/api/categories`, `/api/categories/[id]`)
  - `CategoryModal` and `CategorySelector` components
  - Global categories (seeded) and user-specific categories
  - Category colors for visual distinction
- **Vendor Address Line 2**: Optional `addressLine2` field added to Vendor model
- **Bill Delete**: Delete functionality added to `BillDetailPage` and `BillEditForm`

### Changed

- Enhanced budget prediction logic with deduplication and improved pattern detection
- Improved recurrence handling in bill management
- Refactored vendor selection logic in `BillEditForm`
- Bill amount formatting ensures consistent number handling

### Database Migrations

- `20260112033816_add_vendor_address_line2` - addressLine2 field on Vendor

## [0.2.3]

### Added

- **Bill Creation Page**: New dedicated bill creation page (`/bills/new`) with recurrence features
- **BillEditForm Component**: Refactored bill editing into a reusable component

### Changed

- Enhanced bill update functionality

## [0.2.2]

### Added

- **Category Pie Chart**: Visual category breakdown on dashboard
  - Custom SVG donut chart replacing list view
  - Shows category names, amounts, counts, and percentages
  - Uses category colors when available
  - Interactive legend with hover effects
- **Phone Number Formatting**: Intelligent phone number input and display
  - Auto-formats to `+1 (XXX) XXX-XXXX` for display
  - Stores in E.164 format (`+1XXXXXXXXXX`)
  - `PhoneInput` React component with auto-formatting

### Changed

- Dashboard category display replaced with interactive pie chart
- Category colors now included in stats API response
- Vendor phone numbers automatically formatted for display

## [0.2.1]

### Added

- **Notification Center**: Real-time notification system
  - Bell icon in navbar with unread count badge
  - Notifications for bill assignment and changes by other users
  - `Notification` model in database
  - `/api/notifications` - GET (fetch) and POST (create, admin-only)
  - `/api/notifications/[id]` - PATCH (mark read) and DELETE
  - WebSocket event `notification:new` to `user:{userId}` room

## [0.2.0]

### Added

- **Analysis Tab**: New Analysis feature with three views:
  - Historic Bills Paid: View expense history grouped by period (monthly, quarterly, yearly, or custom date range)
  - Periodic Budget: View budget predictions based on recurrence patterns
  - Vendor Trends: Spending trends for selected vendors across periods
  - Export functionality: Download or print analysis reports as Markdown files
- **Invoice Number Field**: Optional `invoiceNumber` field on bills
- **Quick Mark as Paid**: One-click button in Bill view modal
- **Vendor Trends Tab**: Custom SVG charts (line and bar views) with searchable multi-select vendor selector

### Changed

- **Vendor Structure**: Vendors are now global/shared resources
  - Any authenticated user can create or edit vendors
  - `createdById` field kept for audit purposes only
  - Vendor accounts remain user-specific (filtered by bill ownership)
  - Public endpoint (`/api/vendors/public`) returns vendor names only

### Technical

- `/api/analysis/history` endpoint for historic bills
- `/api/analysis/budget` endpoint for budget predictions
- `/api/analysis/vendor-trends` endpoint for vendor spending trends
- Vendor API routes updated to remove ownership-based authorization
- Real-time WebSocket updates for bills and vendor accounts
- Vendor account filtering based on bill ownership

## [0.1.0] - Initial Release

### Added

- Bill tracking with CRUD operations
- Vendor management with accounts
- Category system (global and user-specific)
- Authentication (local credentials + Keycloak SSO)
- Real-time updates via Socket.IO
- Email notifications via Nodemailer
- File attachments on bills
- Comments on bills
- Calendar view for bills by due date
- Dashboard with statistics
- Anonymous bill entry (no login required)
- Recurrence patterns (monthly, quarterly, biannually, yearly)
- Budget prediction algorithm (linear regression, weighted moving average, seasonal, simple average)

## Notes

- Historical pattern analysis for bills without explicit recurrence is planned for future implementation
- Invoice number field is optional and does not enforce uniqueness
- All monetary values use `Decimal` types (never floating-point) per accounting conventions

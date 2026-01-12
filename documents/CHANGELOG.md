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

### Changed
- Analysis tab added to main navigation
- **Vendor Structure**: Vendors are now global/shared resources
  - Any authenticated user can create or edit vendors
  - `createdById` field kept for audit purposes only (not used for authorization)
  - Vendor accounts remain user-specific (filtered by bill ownership)
  - Public endpoint (`/api/vendors/public`) returns vendor names only (no account numbers)

### Technical
- Added `/api/analysis/history` endpoint for historic bills analysis
- Added `/api/analysis/budget` endpoint for budget predictions
- Added `/api/analysis/vendor-trends` endpoint for vendor spending trends
- **Vendor API Endpoints**:
  - `/api/vendors/public` - Public endpoint for vendor list (id, name only, no accounts)
  - `/api/vendors/public/[id]` - Public endpoint for single vendor (id, name only, no accounts)
  - `/api/vendors` - Authenticated endpoint for vendor list with accounts (filtered by user's bill ownership)
  - `/api/vendors/[id]` - Authenticated endpoint for single vendor with all accounts
- Database schema updated to include `invoiceNumber` field on `Bill` model
- Type definitions updated to include `invoiceNumber` in `Bill` interface
- Vendor API routes updated to remove ownership-based authorization checks
- Vendor account filtering now based on bill ownership (proxy for account ownership)
- Real-time WebSocket updates for vendor accounts (created/updated/deleted events)

## Notes
- Historical pattern analysis for bills without explicit recurrence is planned for future implementation
- Invoice number field is optional and does not enforce uniqueness

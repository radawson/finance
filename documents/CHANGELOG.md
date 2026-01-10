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

### Changed
- Analysis tab added to main navigation

### Technical
- Added `/api/analysis/history` endpoint for historic bills analysis
- Added `/api/analysis/budget` endpoint for budget predictions
- Database schema updated to include `invoiceNumber` field on `Bill` model
- Type definitions updated to include `invoiceNumber` in `Bill` interface

## Notes
- Historical pattern analysis for bills without explicit recurrence is planned for future implementation
- Invoice number field is optional and does not enforce uniqueness

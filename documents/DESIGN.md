# Kontado Design Principles

## Core Philosophy

**THE OVERALL DESIGN GOAL IS TO SIMPLIFY BILL PAYMENT AND TRACKING, NOT COMPLICATE IT!**

## Key Principles

### 1. Simple Entry First
- **Basic bill entry must be fast and uncomplicated**
- Only require essential fields: title, amount, due date, category
- All additional information is **optional** and can be added later
- Never block basic bill entry with advanced features

### 2. Progressive Enhancement
- Start with minimal required information
- Allow users to add details incrementally
- Advanced features enhance but never complicate core workflows
- "Add more details later" should always be an option

### 3. Optional Complexity
- Store rich information when available
- Don't require rich information for basic operations
- Additional fields (account numbers, notes, attachments) are enhancements
- Users can work effectively with minimal data

### 4. User Experience Priority
- **Fast bill entry** > Complete data entry
- **Quick tracking** > Comprehensive details
- **Easy payment management** > Complex categorization
- **Simple workflows** > Feature-rich complexity

## Implementation Guidelines

### Cards and editing
- **Card View** When a card is present on a Dashboard or other screen, clicking that card brings up a read-only summary of that item (i.e. Bill, Vendor)
- **Editing** Each editable item will have it's own page for editing, reachable from an edit icon on the modal, and from an edit icon in a table representing the item.

### Bill Entry
- **Required**: Title, Amount, Due Date, Category
- **Optional**: Vendor, Account Number, Description, Recurrence, Invoice Number
- **Later**: Attachments, Notes, Custom Fields

### Vendor Management
- **Global Structure**: Vendors are shared across all users (global/shared resources)
- **Basic**: Name only
- **Enhanced**: Contact info, address, website
- **Advanced**: Multiple accounts, payment methods, notes
- **Ownership**: Any authenticated user can create or edit vendors
- **Audit Trail**: `createdById` field maintained for audit purposes only (not used for authorization)
- **Accounts**: Vendor accounts remain user-specific (filtered by bill ownership)

### Account Numbers
- **Optional**: Not required for bill entry
- **Progressive**: Add when needed, not upfront
- **Non-blocking**: Bills work perfectly without account numbers
- **Enhancement**: Account numbers improve organization but don't enable core features

### Invoice Numbers
- **Optional**: Not required for bill entry
- **Progressive**: Add when available from vendor invoices
- **Non-blocking**: Bills work perfectly without invoice numbers
- **Enhancement**: Invoice numbers help with vendor record-keeping and reconciliation
- **No uniqueness**: Multiple bills can share the same invoice number if needed

### Calendar View
- **Simple**: Show bills by due date
- **Visual**: Color coding for quick status recognition
- **Non-intrusive**: Doesn't replace list view, complements it

### Budget Prediction Algorithm

The system uses intelligent forecasting to predict future bill amounts 2-4 months ahead with high accuracy.

#### Prediction Methods

The algorithm uses a **hybrid approach** that automatically selects the best prediction method based on available data:

1. **Linear Regression (Trend Analysis)**
   - Used when 3+ bills exist and trend confidence is high (R² ≥ 0.7)
   - Calculates slope and intercept using least squares method
   - Projects future amounts based on detected trend line
   - Best for bills with clear increasing or decreasing patterns
   - Example: Electric bills Sep $200, Oct $250, Nov $275 → predicts Dec ~$235

2. **Weighted Moving Average**
   - Fallback when trend confidence is low (< 0.7)
   - Recent bills weighted more heavily (exponential decay: 40%, 30%, 20%, 10%)
   - Provides stable predictions when trend is unclear
   - Best for bills with variable amounts but no clear trend

3. **Seasonal Average**
   - Used when trend confidence is low (< 0.5) AND multiple years of data exist
   - Groups bills by month across years (e.g., all December bills)
   - Calculates average for that specific month
   - Requires 2+ years of data for the target month
   - Best for bills with seasonal patterns (e.g., insurance premiums)

4. **Simple Average**
   - Used when only 1-2 bills exist
   - Provides baseline prediction until more data is available
   - Lowest confidence (0.3-0.5)

#### Pattern Detection

The system automatically detects recurring patterns from historical data:

- **Automatic Detection**: Bills with 3+ occurrences are analyzed for patterns
- **Interval Analysis**: Calculates intervals between consecutive bills
- **Frequency Detection**: Identifies monthly (~30 days), quarterly (~90 days), biannually (~180 days), or yearly (~365 days) patterns
- **Confidence Scoring**: Based on interval consistency, sample size, and amount variance
- **Priority**: Explicit recurrence patterns take precedence over detected patterns

#### Synthetic Data Generation

For bills with `isRecurring: true` but < 3 data points:

- **Virtual Bills**: System synthesizes 2-3 virtual bills at the specified interval
- **Rudimentary Calculation**: Uses the actual bill amount for all synthetic bills
- **Temporary**: Once >= 3 real data points exist, synthetic data is replaced
- **Lower Confidence**: Synthetic predictions marked with confidence 0.4

#### Prediction Workflow

1. **Fetch Historical Data**: Retrieves bills from 2+ years back for pattern analysis
2. **Detect Patterns**: Automatically identifies recurring bill patterns
3. **Generate Base Predictions**: Creates predictions from explicit and detected patterns
4. **Enhance with Actual Bills**: Replaces predictions with actual bills where dates match
5. **Apply Forecasting**: Uses intelligent algorithms to predict future amounts
6. **Calculate Confidence**: Assigns confidence scores (0-1) to each prediction

#### Example Scenarios

#### Scenario 1: Trending Bills
- Electric: Sep $200, Oct $250, Nov $275
- Method: Linear Regression
- Prediction: Dec ~$235 (trending upward)
- Confidence: High (R² > 0.7)

#### Scenario 2: Stable Bills
- Water: $150/month for 6 months
- Method: Weighted Moving Average
- Prediction: Next month ~$150
- Confidence: Medium-High (0.6-0.7)

#### Scenario 3: Seasonal Bills
- Insurance: $500/year in March for 3 years
- Method: Seasonal Average
- Prediction: Next March ~$500
- Confidence: Medium (0.6) when trend unclear

#### Scenario 4: New Recurring Bill
- New Service: 1 bill at $75 with monthly recurrence
- Method: Synthetic (virtual bills generated)
- Prediction: Next month ~$75
- Confidence: Low (0.4) until 3+ real bills exist

## Design Decisions

### What We Do
✅ Make bill entry as fast as possible
✅ Allow minimal viable bill creation
✅ Support rich data when users want to add it
✅ Provide optional enhancements that don't block core workflows
✅ Progressive disclosure of advanced features
✅ Analyze Bill / Vendor payments to create spend patterns that illuminate monthly, quarterly, Biannual, Yearly and n-period historical and predictive patterns.

### What We Don't Do
❌ Require account numbers for bill entry
❌ Force vendor selection
❌ Mandate detailed descriptions
❌ Block basic operations with advanced features
❌ Overwhelm users with too many fields upfront

## Examples

### Good: Simple Bill Entry
```
Title: "Electric Bill"
Amount: $150.00
Due Date: 2026-01-15
Category: Electricity
[Save] ← Works immediately!

[Optional: Add vendor, account number, notes...]
```

### Bad: Complex Bill Entry
```
Title: *
Amount: *
Due Date: *
Category: *
Vendor: * (required)
Account Number: * (required)
Description: * (required)
Payment Method: * (required)
...
[Save] ← Too many required fields!
```

## Future Enhancements

When adding new features, always ask:
1. **Is this required for basic bill tracking?** If no, make it optional.
2. **Does this block simple entry?** If yes, defer it or make it optional.
3. **Can users work effectively without this?** If yes, it's an enhancement.
4. **Does this simplify or complicate?** Only add if it simplifies.

## Success Metrics

- **Speed**: Can a user enter a bill in under 30 seconds?
- **Simplicity**: Can a new user create their first bill without training?
- **Flexibility**: Can power users add rich details when needed?
- **Satisfaction**: Does the app make bill tracking easier, not harder?

---

**Remember**: Every feature should make bill payment and tracking simpler. If it doesn't, question whether it belongs in the core workflow.

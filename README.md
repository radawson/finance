# Kontado

A modern expense and bill management system built with Next.js, TypeScript, Tailwind CSS, and PostgreSQL.

## Features

### For Users
- Self-registration with email/password
- Create, view, and track bills and expenses
- Anonymous bill entry (no account required)
- Add comments and file attachments to bills
- Real-time updates via WebSocket
- Email notifications for bill updates
- Personal dashboard with bill statistics and category breakdown
- Calendar view for bills by due date
- Recurring bill patterns (monthly, quarterly, biannually, yearly)
- Predicted bills based on recurring patterns
- Analysis views: historic spending, budget predictions, vendor trends
- Credit card balance tracking over time
- Tags for flexible bill and vendor categorization

### For Admins
- SSO authentication via Keycloak OIDC
- View and manage all bills across the organization
- User management at `/admin/users`
- Set bill status (Predicted, Pending, Due Soon, Overdue, Paid, Skipped)
- Real-time notifications for bill changes
- Switch between admin and user views

### Technical Features
- Dual authentication: Local Credentials or Keycloak OIDC
- Real-time updates with Socket.IO
- Email notifications with Nodemailer
- File upload support with local storage
- Modern, responsive UI with Tailwind CSS
- Role-based access control (USER, ADMIN, GUEST)
- Optimized for self-hosting with nginx
- Comprehensive dashboard statistics
- Budget prediction algorithm (linear regression, weighted moving average, seasonal, simple average)
- All monetary values use Decimal types (never floating-point)

## Tech Stack

- **Frontend/Backend**: Next.js 16.x (App Router)
- **Language**: TypeScript 5.x
- **Styling**: Tailwind CSS 4.x
- **Database**: PostgreSQL 14+
- **ORM**: Prisma ORM 7.x
- **Authentication**: NextAuth.js 4.x with Keycloak OIDC
- **Real-time**: Socket.IO 4.x
- **Email**: Nodemailer 7.x
- **Validation**: Zod
- **Icons**: Lucide React
- **Notifications**: React Hot Toast

## Prerequisites

- Node.js 20.19+, 22.12+, or 24+ (required for Prisma 7 and Next.js 16)
- npm 10+
- PostgreSQL 14+
- Keycloak server (optional, for admin SSO)
- SMTP server (optional, for email notifications)

## Quick Start

### 1. Clone and Install

```bash
cd /path/to/kontado
npm install
```

### 2. Configure Environment

```bash
cp example.env .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/kontado?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3003"
NEXTAUTH_SECRET="your-secret-here"  # Generate with: openssl rand -base64 32

# Keycloak OIDC (optional)
KEYCLOAK_ID="your-client-id"
KEYCLOAK_SECRET="your-client-secret"
KEYCLOAK_ISSUER="https://keycloak.example.com/realms/your-realm"

# Email (optional)
SMTP_HOST="localhost"
SMTP_PORT="587"
SMTP_USER="your-email@example.com"
SMTP_PASSWORD="your-password"
SMTP_FROM="Kontado <support@example.com>"

# App
PORT=3003
NEXT_PUBLIC_APP_URL="http://localhost:3003"
```

### 3. Setup Database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# (Optional) Seed default data
npm run db:seed
```

**Note**: With Prisma 7, the client is generated to `src/generated/prisma/` instead of `node_modules/@prisma/client/`.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3003](http://localhost:3003)

### 5. Create First User

1. Navigate to [http://localhost:3003/register](http://localhost:3003/register)
2. Register a new user account
3. Use this account to create and manage bills

### 6. Admin Login (Keycloak SSO)

1. Navigate to [http://localhost:3003/login](http://localhost:3003/login)
2. Click "IT Admin Login (SSO)"
3. Login with your Keycloak credentials
4. Admins are automatically identified via Keycloak roles

## Production Deployment

For detailed deployment instructions, see [documents/DEPLOYMENT.md](documents/DEPLOYMENT.md).

Quick summary:
1. Install Node.js, PostgreSQL, nginx
2. Configure environment variables
3. Build application: `npm run build`
4. Run with PM2: `pm2 start ecosystem.config.js`
5. Configure nginx as reverse proxy
6. Setup SSL with Let's Encrypt

## Project Structure

```
kontado/
├── prisma/
│   ├── schema.prisma              # Database schema
│   ├── seed.ts                    # Database seeding
│   └── migrations/                # Database migrations
├── src/
│   ├── app/
│   │   ├── api/                   # API routes
│   │   │   ├── auth/              # NextAuth & registration
│   │   │   ├── bills/             # Bill CRUD, anonymous, predicted
│   │   │   ├── vendors/           # Vendor CRUD, public endpoints, accounts
│   │   │   ├── categories/        # Category CRUD
│   │   │   ├── analysis/          # History, budget, vendor-trends, credit-card-balances
│   │   │   ├── stats/             # Dashboard statistics
│   │   │   ├── notifications/     # Notification management
│   │   │   ├── account-types/     # Account type management
│   │   │   ├── dashboard/          # Dashboard preferences
│   │   │   ├── admin/             # Admin endpoints (users)
│   │   │   └── version/           # App version
│   │   ├── dashboard/             # Main dashboard
│   │   ├── bills/                 # Bills list, detail, calendar, new
│   │   ├── vendors/               # Vendor list and detail
│   │   ├── analysis/              # Analysis views
│   │   ├── categories/            # Category management
│   │   ├── admin/                 # Admin pages (users)
│   │   └── layout.tsx
│   ├── components/                # Reusable UI components
│   ├── lib/                       # Server utilities
│   │   ├── prisma.ts              # Prisma client
│   │   ├── auth.ts                # NextAuth configuration
│   │   ├── email.ts               # Email utilities
│   │   ├── socketio-server.ts     # Socket.IO event helpers
│   │   ├── analysis.ts            # Analysis/prediction algorithms
│   │   ├── bills.ts               # Bill status calculation
│   │   ├── balance-snapshots.ts   # Balance snapshot recording
│   │   ├── dashboard-layout.ts    # Dashboard widget definitions and layouts
│   │   └── business/              # Business logic (predictions, recurring)
│   └── types/
│       └── index.ts               # TypeScript types
├── server.js                      # Custom server (Next.js + Socket.IO)
├── ecosystem.config.js            # PM2 configuration
├── documents/                     # Documentation
├── scripts/                       # Deployment and utility scripts
├── public/                        # Static assets and icons
└── example.env                    # Environment template
```

## Database Schema

### Core Models
- **User** - Dual auth (credentials + Keycloak SSO), roles (USER, ADMIN, GUEST)
- **Bill** - Full lifecycle: PREDICTED, PENDING, DUE_SOON, OVERDUE, PAID, SKIPPED
- **Category** - Global and user-specific, with colors
- **Vendor** - Global/shared, with contact info, address, tags
- **VendorAccount** - Account numbers, balance tracking, interest rates
- **RecurrencePattern** - Monthly, quarterly, biannually, yearly

### Supporting Models
- **Comment** - Bill comments (anonymous or authenticated)
- **Attachment** - File uploads on bills
- **Notification** - Real-time notification system
- **AccountType** - Account classification (Credit Card, Mortgage, etc.)
- **VendorAccountBalanceSnapshot** - Balance history over time
- **UserDashboardPrefs** - Per-user dashboard layout and widget visibility

## API Reference

See [documents/API.md](documents/API.md) for the complete API reference.

### Key Endpoints
- `GET/POST /api/bills` - List and create bills
- `GET/PATCH/DELETE /api/bills/[id]` - Bill detail operations
- `POST /api/bills/anonymous` - Anonymous bill entry
- `GET /api/bills/predicted` - Generate predicted bills
- `GET /api/stats` - Dashboard statistics
- `GET /api/analysis/history` - Historic spending
- `GET /api/analysis/budget` - Budget predictions
- `GET /api/analysis/vendor-trends` - Vendor spending trends
- `GET /api/analysis/credit-card-balances` - Balance snapshots
- `GET/POST /api/vendors` - Vendor management
- `GET /api/vendors/public` - Public vendor list (no auth)
- `GET/POST /api/categories` - Category management
- `GET/PATCH /api/dashboard/prefs` - Dashboard layout preferences
- `GET /api/notifications` - User notifications

## Configuration

### Keycloak SSO Setup

See [documents/KEYCLOAK.md](documents/KEYCLOAK.md) for comprehensive instructions.

### SMTP Configuration

For development, use [Mailtrap](https://mailtrap.io) or skip email entirely.

For production, configure your SMTP server in `.env`.

### File Upload Configuration

```env
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE="10485760"  # 10MB in bytes
```

## Development

### Run in Development Mode

```bash
npm run dev
```

### Build for Production

```bash
npm run build
npm start
```

### Database Operations

```bash
# Quick update scripts
npm run db:update          # Production: apply migrations + regenerate client
npm run db:update:dev      # Development: create new migrations
npm run db:update:seed     # Production + seed data

# Manual operations
npx prisma generate        # Regenerate Prisma client
npx prisma migrate dev     # Create migration (dev)
npx prisma migrate deploy  # Apply migrations (production)
npx prisma migrate reset   # Reset database (WARNING: deletes all data)
npm run db:seed            # Seed default data
npx prisma studio          # Database GUI
```

### Database Seeding

```bash
npm run db:seed
```

Creates: admin user (`admin@kontado.local` / `password`) and 15 global bill categories.

### Test Data Generation (Development Only)

```bash
npm run db:seed:test
```

Generates diverse bill scenarios for testing budget forecasting (trending, stable, seasonal patterns).

### Version Management

```bash
npm run version-patch   # 0.2.6 -> 0.2.7
npm run version-minor   # 0.2.6 -> 0.3.0
npm run version-major   # 0.2.6 -> 1.0.0
```

## Prisma 7 Notes

- Generated client location: `src/generated/prisma/`
- Import path: `@/generated/prisma/client`
- Node.js requirement: 20.19+, 22.12+, or 24+
- Run `npx prisma generate` after pulling schema changes

## Troubleshooting

### Node.js Version
Prisma 7 requires Node.js 20.19+. Check with `node --version`.

### Prisma Generate Errors
```bash
npx prisma generate
```

### Database Connection
```bash
sudo systemctl status postgresql
psql -U your_user -d kontado
```

### Real-time Updates Not Working
- Check browser console for Socket.IO errors
- Verify port 3003 is accessible
- Check PM2 logs: `pm2 logs kontado`

### File Upload Failing
- Ensure `uploads/` directory exists and is writable
- Check `MAX_FILE_SIZE` setting

## Documentation

- [API Reference](documents/API.md)
- [Deployment Guide](documents/DEPLOYMENT.md)
- [Quick Start Guide](documents/QUICKSTART.md)
- [Keycloak Setup](documents/KEYCLOAK.md)
- [Design Principles](documents/DESIGN.md)
- [WebSocket Setup](documents/WEBSOCKET_SETUP.md)
- [Nginx Deployment](documents/NGINX_DEPLOYMENT.md)
- [Changelog](documents/CHANGELOG.md)

## Support

For issues or questions:
1. Check logs: `pm2 logs kontado`
2. Review nginx logs: `/var/log/nginx/kontado_error.log`
3. Check database logs
4. Contact your system administrator

## License

See [LICENSE.md](LICENSE.md)

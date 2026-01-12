# Kontadoo

A modern expense and bill management system built with Next.js, TypeScript, Tailwind CSS, and PostgreSQL.

## Features

### For Users
- ✅ Self-registration with email/password
- ✅ Create, view, and track support bills
- ✅ Add comments to bills
- ✅ Upload file attachments (up to 10MB)
- ✅ Real-time updates via WebSocket
- ✅ Email notifications for bill updates
- ✅ Personal dashboard with bill statistics
- ✅ Filter and search bills
- ✅ View bill history and status changes
- ✅ Anonymous bill submission with access code (no account required)
- ✅ Access bills via magic link or access code from email

### For IT Admins
- ✅ SSO authentication via Keycloak OIDC
- ✅ System-wide bill management dashboard
- ✅ Assign bills to admins or pick from pending pool
- ✅ Set bill status (Open, In Progress, Waiting, Resolved, Closed)
- ✅ Set bill priority (Low, Medium, High, Critical)
- ✅ Add internal notes (not visible to users)
- ✅ View all bills across the organization
- ✅ Filter by status, priority, assignment, and more
- ✅ Real-time notifications for new bills
- ✅ Track average resolution times
- ✅ Switch between admin and user views

### Technical Features
- 🔐 Dual authentication: Local Credentials or Keycloak OIDC
- 🔄 Real-time updates with Socket.io
- 📧 Email notifications with Nodemailer
- 📁 File upload support with local storage
- 🎨 Modern, responsive UI with Tailwind CSS
- 🔒 Role-based access control
- 🚀 Optimized for self-hosting with nginx
- 📊 Comprehensive dashboard statistics
- 🔍 Advanced filtering and search

## Tech Stack

- **Frontend/Backend**: Next.js 16.0.8 (App Router)
- **Language**: TypeScript 5.x
- **Styling**: Tailwind CSS 4.x
- **Database**: PostgreSQL 14+
- **ORM**: Prisma ORM 7.x
- **Authentication**: NextAuth.js 4.x with Keycloak OIDC
- **Real-time**: Socket.io 4.x
- **Email**: Nodemailer 7.x
- **Icons**: Lucide React
- **Notifications**: React Hot Toast

## Prerequisites

- Node.js 20.19+, 22.12+, or 24+ (required for Prisma 7 and Next.js 16.0.7+)
- npm 10+
- PostgreSQL 14+
- Keycloak server (for admin SSO)
- SMTP server (optional for email notifications)

## Quick Start

### 1. Clone and Install

```bash
cd /path/to/kontado
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dbname?schema=public"

# For production clusters, use the cluster port (e.g., 5433) which auto-routes to leader
# DATABASE_URL="postgresql://user:password@cluster-host:5433/dbname?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"

# Keycloak OIDC
KEYCLOAK_ID="your-client-id"
KEYCLOAK_SECRET="your-client-secret"
KEYCLOAK_ISSUER="https://keycloak.example.com/realms/your-realm"

# Email
SMTP_HOST="localhost"
SMTP_PORT="587"
SMTP_USER="your-email@example.com"
SMTP_PASSWORD="your-password"
SMTP_FROM="IT Support <support@example.com>"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Generate a secure NextAuth secret:
```bash
openssl rand -base64 32
```

### 3. Setup Database

**Note**: With Prisma 7, the Prisma client is generated to `src/generated/prisma/` instead of `node_modules/@prisma/client/`.

```bash
# Generate Prisma client (required after any schema changes)
npx prisma generate

# Run migrations
npx prisma migrate dev

# Or for production
npx prisma migrate deploy
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Create First User

1. Navigate to [http://localhost:3000/register](http://localhost:3000/register)
2. Register a new user account
3. Use this account to create bills

### 6. Admin Login (Keycloak SSO)

1. Navigate to [http://localhost:3000/login](http://localhost:3000/login)
2. Click "IT Admin Login (SSO)"
3. Login with your Keycloak credentials
4. Admins are automatically identified via Keycloak

## Production Deployment

For production deployment on Ubuntu with nginx, see [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

Quick summary:
1. Install Node.js, PostgreSQL, nginx
2. Configure environment variables
3. Build application: `npm run build`
4. Run with PM2: `pm2 start ecosystem.config.js`
5. Configure nginx as reverse proxy
6. Setup SSL with Let's Encrypt

## Project Structure

```
bills/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/
│   │   ├── (auth)/            # Authentication pages
│   │   ├── (user)/            # User pages (dashboard, bills)
│   │   ├── (admin)/           # Admin pages
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # NextAuth & registration
│   │   │   ├── bills/         # bill CRUD
│   │   │   ├── stats/         # Dashboard statistics
│   │   │   └── users/         # User management
│   │   └── layout.tsx
│   ├── components/            # Reusable UI components
│   │   ├── Navbar.tsx
│   │   ├── billCard.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── PriorityBadge.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client
│   │   ├── auth.ts            # NextAuth configuration
│   │   ├── email.ts           # Email utilities
│   │   └── socket.ts          # Socket.io configuration
│   └── types/
│       └── index.ts           # TypeScript types
├── public/
├── uploads/                   # File uploads (created at runtime)
├── .env                       # Environment variables (not in git)
├── package.json
└── README.md
```

## Database Schema

### Users
- Dual authentication support (credentials + Keycloak SSO)
- Role-based access (USER, ADMIN)
- Department tracking

### bills
- Complete lifecycle management
- Priority and category classification
- Assignment tracking
- Automatic timestamps

### Comments
- Support for internal admin notes
- Full conversation history
- User attribution

### Attachments
- File metadata storage
- Size and type tracking
- Upload attribution

## API Routes

### Authentication
- `POST /api/auth/register` - User registration
- `GET/POST /api/auth/[...nextauth]` - NextAuth handlers

### bills
- `GET /api/bills` - List bills (filtered by role)
- `POST /api/bills` - Create bill
- `GET /api/bills/[id]` - Get bill details
- `PATCH /api/bills/[id]` - Update bill
- `DELETE /api/bills/[id]` - Delete bill (admin only)
- `GET /api/bills/magic/[token]` - View bill via magic link token or access code
  - Accepts full magic tokens (64 hex characters) for authenticated access
  - Accepts full bill UUIDs (32 or 36 characters, with or without dashes)
  - Accepts 12+ character bill ID prefixes as admin shortcut
- `POST /api/bills/magic/[token]/comment` - Add comment via magic link

### Comments & Attachments
- `POST /api/bills/[id]/comments` - Add comment
- `POST /api/bills/[id]/attachments` - Upload file

### Statistics
- `GET /api/stats` - Dashboard statistics

### Users
- `GET /api/users` - List users (admin only)

## Configuration

### Keycloak SSO Setup

For comprehensive Keycloak configuration instructions, see **[KEYCLOAK.md](./documents/KEYCLOAK.md)**.

**Quick Reference:**
- Client ID: `ptx-finance`
- Roles: `USER`, `ADMIN`, `GUEST`
- Admin role variants: `it_admin`, `administrator`
- Issuer: `https://logon.partridgecrossing.org/realms/ptx`

### SMTP Configuration

For development, you can use:
- Local SMTP server (Postfix on Ubuntu)
- Gmail with app password
- Mailtrap for testing

For production:
- Organization SMTP server
- SendGrid
- AWS SES
- Mailgun

### File Upload Configuration

Configure in `.env`:
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

#### Quick Update Script

For convenience, use the update script to handle migrations and schema changes in the correct order:

```bash
# Production: Apply existing migrations and regenerate client
npm run db:update

# Development: Create new migrations if schema changed
npm run db:update:dev

# Production with seeding (applies migrations, regenerates client, then seeds)
npm run db:update:seed
```

Or run the script directly:
```bash
./scripts/update-db.sh deploy        # Production mode
./scripts/update-db.sh dev           # Development mode
./scripts/update-db.sh deploy --seed # Production with seeding
```

#### Manual Database Operations

```bash
# Generate Prisma client (run after schema changes)
npx prisma generate

# Create migration
npx prisma migrate dev --name description

# Apply migrations (production)
npx prisma migrate deploy

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Seed database with default data (admin user, categories)
npm run db:seed

# Open Prisma Studio (database GUI)
npx prisma studio
```

**Note**: With Prisma 7, you must run `npx prisma generate` after running migrations to regenerate the client with the updated schema.

### Database Seeding

The seed script creates essential data for a fresh Kontado installation:

```bash
npm run db:seed
```

**What it creates:**
- **Admin User**: `admin@kontado.local` with password `password` (change in production!)
- **Global Categories**: 15 predefined bill categories (Electricity, Gas, Internet, etc.)

**Safety Features:**
- Checks for existing data before creating duplicates
- Updates existing categories with new descriptions/colors
- Safe to run multiple times
- Requires database connection to be available

**For Production:**
1. Run seeding after initial migration
2. Change the default admin password immediately
3. Consider creating additional admin accounts

#### Test Data Generation (Development Only)

**⚠️ WARNING: This command is for development/testing only. Do NOT run in production!**

The test data script generates diverse bill scenarios for testing budget forecasting algorithms:

```bash
npm run db:seed:test
```

**What it creates:**
- Electric bills with trending amounts (Sep $200, Oct $250, Nov $275)
- Water bills with stable pattern ($150/month for 6 months)
- Insurance bills with seasonal pattern ($500/year for 3 years)
- Gas bills with slight upward trend ($80, $85, $90, $95)
- Phone bills with perfect monthly pattern ($45/month for 12 months)
- Rent bills with long-term stable pattern ($1200/month for 24 months)
- Bills with recurring flag but < 3 data points (tests synthetic data generation)

**Use Cases:**
- Testing budget prediction algorithms
- Development and debugging of forecasting features
- Demonstrating prediction accuracy with known data patterns

**Safety:**
- Creates test user: `test@kontado.local`
- Uses test category and vendor IDs prefixed with `test-`
- Safe to run multiple times (uses upsert operations)
- **Never run in production databases with real data**

**Troubleshooting Database Connections:**
If seeding fails with read-only errors, you may be connecting to a read-only replica:

```bash
# Test if you're on a read-only replica (should return 'f' for primary)
psql "$DATABASE_URL" -c "SELECT pg_is_in_recovery()"

# Test basic connectivity
psql "$DATABASE_URL" -c "SELECT version()"

# For database clusters, use the cluster port (e.g., 5433) which auto-routes to leader
# Example: DATABASE_URL="postgresql://user:pass@cluster-host:5433/dbname"
```

### Linting

```bash
npm run lint
```

### Version Management

This project uses semantic versioning. To increment versions:

```bash
# Increment patch version (1.0.9 -> 1.0.10)
npm run version-patch

# Increment minor version (1.0.9 -> 1.1.0)
npm run version-minor

# Increment major version (1.0.9 -> 2.0.0)
npm run version-major
```

These commands will:
1. Update the version in `package.json` and `package-lock.json`
2. Create a git commit with the version change
3. Create a git tag for the version

## Features in Detail

### Real-time Updates

The application uses Socket.io for real-time updates:
- New bill notifications for admins
- Status change notifications
- New comment notifications
- Automatic UI updates without refresh

### Email Notifications

Automated emails are sent for:
- bill creation confirmation
- New bill alerts to admins
- bill assignment to admins
- Status changes
- New comments

### File Uploads

- Maximum file size: 10MB (configurable)
- Stored locally in `uploads/` directory
- Organized by bill ID
- Metadata stored in database
- Secure download links

### Security

- Password hashing with bcrypt
- JWT-based sessions
- Role-based access control
- Protected API routes
- Input validation with Zod
- SQL injection prevention (Prisma)
- XSS protection (React)

## Customization

### Styling

Edit Tailwind configuration in `tailwind.config.ts`:
```typescript
theme: {
  extend: {
    colors: {
      primary: { /* your colors */ },
    },
  },
}
```

### Email Templates

Customize email templates in `src/lib/email.ts`

### bill Categories

Add or modify categories in `prisma/schema.prisma`:
```prisma
enum billCategory {
  HARDWARE
  SOFTWARE
  NETWORK
  ACCESS
  YOUR_CATEGORY
  OTHER
}
```

Then run: `npx prisma migrate dev`

## Prisma 7 Migration Notes

This project uses Prisma ORM 7, which has some important differences from Prisma 5/6:

### Key Changes
1. **Generated Client Location**: The Prisma client is now generated to `src/generated/prisma/` instead of `node_modules/@prisma/client/`
2. **Import Paths**: All imports now use `@/generated/prisma/client` instead of `@prisma/client`
3. **Node.js Requirement**: Minimum Node.js version is now 20.19.0 or 22.12+
4. **Custom Output Path**: The `generator` block specifies `output = "../src/generated/prisma"`

### After Pulling Updates
If you pull updates that include Prisma schema changes, run:
```bash
npx prisma generate
```

## Troubleshooting

### Node.js Version Issues
Prisma 7 requires Node.js 20.19+, 22.12+, or 24+. If you see engine errors:
```bash
# Check your current Node.js version
node --version

# If using nvm, upgrade to a compatible version
nvm install --lts  # Installs latest LTS (currently v24.x)
nvm use --lts

# Or install a specific version
nvm install 22.12
nvm use 22.12
```

### Prisma Generate Errors
If you see errors about missing `@prisma/client` or `@/generated/prisma/client`:
```bash
# Make sure you're using a compatible Node.js version first
node --version

# Regenerate the Prisma client
npx prisma generate
```

### Database Connection Issues
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U your_user -d billdb
```

### Email Not Sending
- Check SMTP credentials
- Verify SMTP server allows connections
- Check firewall rules
- Review application logs

### Real-time Updates Not Working
- Ensure Socket.io connection is established
- Check browser console for errors
- Verify WebSocket connections aren't blocked

### File Upload Failing
- Check `uploads/` directory exists and is writable
- Verify `MAX_FILE_SIZE` setting
- Check disk space

## Contributing

This is a private project for your organization. For modifications:

1. Create a feature branch
2. Make changes
3. Test thoroughly
4. Update documentation
5. Deploy to staging first

## Support

For issues or questions:
1. Check logs: `pm2 logs it-bills`
2. Review nginx logs: `/var/log/nginx/bills-error.log`
3. Check database logs
4. Contact your system administrator

## License

See License.md

---



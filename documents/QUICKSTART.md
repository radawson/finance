# Quick Start Guide

Get up and running with the accounting System in minutes!

## For Development (Local Machine)

### 1. Prerequisites Check

```bash
# Check Node.js version (need 18+)
node --version

# Check npm
npm --version

# Check PostgreSQL (need 14+)
psql --version
```

### 2. Database Setup

```bash
# Login to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE ticketdb;
CREATE USER ticketuser WITH PASSWORD 'devpassword';
GRANT ALL PRIVILEGES ON DATABASE ticketdb TO ticketuser;
\q
```

### 3. Install Dependencies

```bash
cd /home/torvaldsl/tickets
npm install
```

### 4. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env and set minimum required values
nano .env
```

**Minimum configuration for development:**

```env
DATABASE_URL="postgresql://ticketuser:devpassword@localhost:5432/ticketdb?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret-change-in-production-use-openssl-rand-base64-32"

# Keycloak (can skip for now if testing without admin SSO)
KEYCLOAK_ID="your-client-id"
KEYCLOAK_SECRET="your-client-secret"
KEYCLOAK_ISSUER="https://your-keycloak.com/realms/your-realm"

# Email (use Mailtrap or skip for testing)
SMTP_HOST="sandbox.smtp.mailtrap.io"
SMTP_PORT="2525"
SMTP_USER="your-mailtrap-user"
SMTP_PASSWORD="your-mailtrap-password"
SMTP_FROM="IT Support <support@example.com>"

NEXT_PUBLIC_APP_URL="http://localhost:3000"
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE="10485760"
```

### 5. Initialize Database

```bash
# Run migrations
npx prisma migrate dev

# (Optional) Open Prisma Studio to view database
npx prisma studio
```

### 6. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 7. Create Test Accounts

**Regular User:**
1. Go to http://localhost:3000/register
2. Fill in:
   - Name: Test User
   - Email: user@test.com
   - Password: testpass123
   - Department: Engineering
3. Click "Create account"
4. Login at http://localhost:3000/login

**Admin User (if Keycloak not configured):**

Manually create an admin in the database:

```bash
# Run this script to create an admin user
npx prisma studio

# Or use psql:
psql -U ticketuser -d ticketdb

# In psql, insert admin user:
INSERT INTO "User" (id, email, name, password, role, "isKeycloakUser", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@test.com',
  'Admin User',
  '$2a$10$YourHashedPasswordHere',  -- Hash "adminpass123" with bcrypt
  'ADMIN',
  false,
  NOW(),
  NOW()
);
```

Or use this Node.js script:

```javascript
// create-admin.js
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('adminpass123', 10)
  
  const admin = await prisma.user.create({
    data: {
      email: 'admin@test.com',
      name: 'Admin User',
      password: hashedPassword,
      role: 'ADMIN',
      isKeycloakUser: false,
    },
  })
  
  console.log('Admin created:', admin)
}

main()
  .then(async () => await prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
```

Run it:
```bash
node create-admin.js
```

## Testing the Application

### As a Regular User:

1. **Login** at http://localhost:3000/login
2. **Create a ticket:**
   - Click "New Ticket" or go to http://localhost:3000/tickets/new
   - Fill in title, description, category
   - Submit
3. **View your tickets** at http://localhost:3000/tickets
4. **View dashboard** at http://localhost:3000/dashboard
5. **Add comments** to your tickets
6. **Upload files** to tickets

### As an Admin:

1. **Login** at http://localhost:3000/login
2. **View admin dashboard** at http://localhost:3000/admin/dashboard
3. **View all tickets** at http://localhost:3000/admin/tickets
4. **Manage a ticket:**
   - Click on any ticket
   - Change status, priority
   - Assign to yourself or other admins
   - Add comments (can mark as internal)
5. **Switch to user view** by clicking "User View" in navbar

## Common Development Tasks

### Reset Database

```bash
# WARNING: This deletes all data!
npx prisma migrate reset
```

### View Database

```bash
# Open Prisma Studio
npx prisma studio
```

### Check Logs

```bash
# Development server shows logs in terminal
# Check browser console for client-side errors
```

### Test Email Notifications

Use [Mailtrap](https://mailtrap.io) for testing:
1. Sign up for free account
2. Get SMTP credentials
3. Add to `.env`
4. All emails will be caught by Mailtrap

### Test Real-time Updates

1. Open two browser windows
2. Login as user in one, admin in another
3. Create/update tickets
4. Watch real-time updates in both windows

## Troubleshooting

### Port 3000 already in use

```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>

# Or use different port
PORT=3001 npm run dev
```

### Database connection failed

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Verify connection string in .env
```

### Prisma errors

```bash
# Regenerate Prisma client
npx prisma generate

# Reset and migrate
npx prisma migrate reset
```

### Module not found errors

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

## Development Tips

### Hot Reload

Next.js automatically reloads when you save files. If it doesn't:
```bash
# Restart dev server
# Ctrl+C then npm run dev
```

### Environment Variables

After changing `.env`:
```bash
# Restart dev server for changes to take effect
```

### Database Schema Changes

After editing `prisma/schema.prisma`:
```bash
# Create migration
npx prisma migrate dev --name your_change_description

# Or just push changes without migration (dev only)
npx prisma db push
```

### Debugging

Add `console.log()` statements or use browser DevTools:
- Network tab: Check API requests
- Console tab: Check for errors
- Application tab: Check localStorage/cookies

## Next Steps

1. **Configure Keycloak** for admin SSO (see DEPLOYMENT.md)
2. **Setup real SMTP** for email notifications
3. **Customize** colors, categories, etc.
4. **Add test data** for realistic testing
5. **Deploy to staging** before production

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js Documentation](https://next-auth.js.org)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## Need Help?

- Check `README.md` for detailed documentation
- Check `DEPLOYMENT.md` for production setup
- Review code comments
- Check browser console and terminal logs

---

Happy coding! 🚀


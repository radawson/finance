# Kontado Deployment Guide

This guide explains how to deploy Kontado to production using PM2.

## Prerequisites

- Node.js >= 18.18.0
- PostgreSQL database
- PM2 (will be installed automatically if not present)
- Docker (optional, for running PostgreSQL locally)

## Environment Setup

1. Create a `.env` file in the project root with the following variables:

```bash
# Database
DATABASE_URL="postgresql://username:password@host:port/database"

# NextAuth
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-secret-key"  # Generate with: openssl rand -base64 32

# Keycloak (optional)
KEYCLOAK_CLIENT_ID="your-client-id"
KEYCLOAK_CLIENT_SECRET="your-client-secret"
KEYCLOAK_ISSUER="https://your-keycloak-server.com/realms/your-realm"

# Email (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="your-email@gmail.com"

# Application
APP_URL="https://your-domain.com"
```

## Production Deployment

### Option 1: Quick Deploy

Simply run the deployment script:

```bash
./deploy.sh
```

This script will:

1. Install dependencies
2. Build the application
3. Clean up dev dependencies
4. Run database migrations
5. Start the application with PM2

### Option 2: Manual Deployment

```bash
# 1. Install dependencies
npm ci

# 2. Build the application
npm run build

# 3. Run database migrations
npx prisma migrate deploy

# 4. Start with PM2
pm2 start ecosystem.config.js
pm2 save
```

## Development Deployment

To deploy in development mode with PM2:

```bash
./deploy-dev.sh
```

This will:
1. Start Docker containers
2. Install all dependencies
3. Start the application in development mode with PM2

## PM2 Management Commands

```bash
# Check status
pm2 status

# View logs
pm2 logs quicket

# View real-time logs
pm2 logs quicket --lines 100

# Restart application
pm2 restart quicket

# Stop application
pm2 stop quicket

# Monitor resources
pm2 monit

# Delete process
pm2 delete quicket
```

## Nginx Configuration (Recommended)

For production, it's recommended to use Nginx as a reverse proxy:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support for Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## SSL/HTTPS Setup

Use Certbot for free SSL certificates:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Database Migrations

### Run Migrations

```bash
npx prisma migrate deploy
```

### Create New Migration (Development)

```bash
npx prisma migrate dev --name migration_name
```

## Troubleshooting

### Check Logs

```bash
# PM2 logs
pm2 logs quicket

# System logs
journalctl -u quicket -f
```

### Database Connection Issues

1. Check DATABASE_URL in `.env`
2. Ensure PostgreSQL is running
3. Verify database credentials
4. Check firewall settings

### Build Failures

1. Clear Next.js cache: `rm -rf .next`
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Check Node.js version: `node --version` (should be >= 18.18.0)

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

## Performance Optimization

### PM2 Cluster Mode

For better performance with multiple CPU cores, edit `ecosystem.config.js`:

```javascript
instances: 'max',  // or specific number
exec_mode: 'cluster'
```

### Memory Management

PM2 will automatically restart if memory exceeds 1GB (configurable in `ecosystem.config.js`).

## Backup

### Database Backup

```bash
pg_dump -U username -d quicket > backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
psql -U username -d quicket < backup_20250111.sql
```

## Monitoring

### PM2 Plus (Optional)

For advanced monitoring:

```bash
pm2 link <secret> <public>
```

Visit https://app.pm2.io for dashboard.

## Updates

To update the application:

```bash
git pull
./deploy.sh
```

## Rollback

```bash
# Revert to previous commit
git reset --hard HEAD~1

# Redeploy
./deploy.sh
```

## Support

For issues, check:
- Application logs: `pm2 logs quicket`
- System logs: `journalctl -u quicket`
- Database logs: Check PostgreSQL logs

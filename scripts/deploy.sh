#!/bin/bash

# Kontado Deployment Script
# This script builds and deploys the application to PM2

set -e  # Exit on any error

echo "🚀 Starting deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}❌ PM2 is not installed. Installing PM2...${NC}"
    npm install -g pm2
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found!${NC}"
    echo "Please create a .env file with the required environment variables."
    exit 1
fi

echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm ci

echo -e "${YELLOW}🔨 Building application...${NC}"
npm run build

echo -e "${YELLOW}🧹 Cleaning up dev dependencies...${NC}"
npm prune --omit=dev

echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
npx prisma migrate deploy

echo -e "${YELLOW}📁 Creating logs directory...${NC}"
mkdir -p logs

echo -e "${YELLOW}🔄 Stopping existing PM2 process (if any)...${NC}"
pm2 delete Kontado 2>/dev/null || echo "No existing process to stop"

echo -e "${YELLOW}🚀 Starting application with PM2...${NC}"
pm2 start ecosystem.config.js

echo -e "${YELLOW}💾 Saving PM2 process list...${NC}"
pm2 save

echo -e "${YELLOW}⚙️  Setting up PM2 startup script...${NC}"
pm2 startup systemd -u $USER --hp $HOME || echo "PM2 startup already configured"

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Useful PM2 commands:"
echo "  pm2 status            - Check application status"
echo "  pm2 logs Kontado    - View application logs"
echo "  pm2 restart Kontado - Restart the application"
echo "  pm2 stop Kontado    - Stop the application"
echo "  pm2 monit             - Monitor application"


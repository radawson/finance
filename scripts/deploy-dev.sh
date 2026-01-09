#!/bin/bash

# Kontado Development Deployment Script
# This script starts the application in development mode with PM2

set -e  # Exit on any error

echo "🚀 Starting development deployment..."

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

# Check if docker-compose.yml exists and start containers
if [ -f docker-compose.yml ]; then
    echo -e "${YELLOW}🐳 Starting Docker containers...${NC}"
    docker compose up -d
fi

echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

echo -e "${YELLOW}📁 Creating logs directory...${NC}"
mkdir -p logs

echo -e "${YELLOW}🔄 Stopping existing PM2 process (if any)...${NC}"
pm2 delete Kontado-dev 2>/dev/null || echo "No existing process to stop"

echo -e "${YELLOW}🚀 Starting application in development mode with PM2...${NC}"
pm2 start ecosystem.config.js --env development --name Kontado-dev

echo -e "${GREEN}✅ Development deployment complete!${NC}"
echo ""
echo "Useful PM2 commands:"
echo "  pm2 status                - Check application status"
echo "  pm2 logs Kontado-dev    - View application logs"
echo "  pm2 restart Kontado-dev - Restart the application"
echo "  pm2 stop Kontado-dev    - Stop the application"


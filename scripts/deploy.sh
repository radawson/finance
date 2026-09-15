#!/bin/bash

# Kontado Deployment Script
# Builds the app and (re)starts it under systemd as kontado.service.

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
UNIT_SRC="$REPO_DIR/deploy/kontado.service"
UNIT_DST="/etc/systemd/system/kontado.service"

cd "$REPO_DIR"

echo "Starting Kontado deployment..."

if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please create a .env file with the required environment variables."
    exit 1
fi

if [ ! -f "$UNIT_SRC" ]; then
    echo -e "${RED}Error: systemd unit not found at $UNIT_SRC${NC}"
    exit 1
fi

echo -e "${YELLOW}Installing dependencies...${NC}"
npm ci

echo -e "${YELLOW}Building application...${NC}"
npm run build

echo -e "${YELLOW}Running database migrations...${NC}"
npx prisma migrate deploy

echo -e "${YELLOW}Build and migrate complete.${NC}"
echo "Install or restart the systemd unit with:"
echo "  sudo bash $REPO_DIR/deploy/install-kontado-systemd.sh"
echo ""
echo "That copies $UNIT_SRC to $UNIT_DST, enables the unit,"
echo "drops leftover PM2 'kontado', and starts the service."
echo ""
echo "Afterwards:"
echo "  systemctl status kontado"
echo "  journalctl -u kontado -f"
echo "  sudo systemctl restart kontado"

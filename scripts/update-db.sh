#!/bin/bash
# Database update script for Kontado
# Handles migrations and Prisma client regeneration in the correct order

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Kontado Database Update Script${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}✗ Error: .env file not found${NC}"
    echo "Please create a .env file from example.env"
    exit 1
fi

# Determine migration mode (dev or deploy)
MODE="${1:-deploy}"

if [ "$MODE" = "dev" ]; then
    echo -e "${YELLOW}Mode: Development (migrate dev)${NC}"
    echo -e "${YELLOW}This will create new migrations if schema changed${NC}"
    echo ""
    MIGRATE_CMD="npx prisma migrate dev"
elif [ "$MODE" = "deploy" ]; then
    echo -e "${YELLOW}Mode: Production (migrate deploy)${NC}"
    echo -e "${YELLOW}This will apply existing migrations only${NC}"
    echo ""
    MIGRATE_CMD="npx prisma migrate deploy"
else
    echo -e "${RED}✗ Error: Invalid mode '${MODE}'${NC}"
    echo "Usage: $0 [dev|deploy] [--seed]"
    exit 1
fi

# Check for --seed flag
RUN_SEED=false
if [[ "$*" == *"--seed"* ]]; then
    RUN_SEED=true
fi

# Step 1: Run migrations
echo -e "${BLUE}Step 1: Running database migrations...${NC}"
if $MIGRATE_CMD; then
    echo -e "${GREEN}✓ Migrations applied successfully${NC}"
else
    echo -e "${RED}✗ Migration failed${NC}"
    exit 1
fi
echo ""

# Step 2: Regenerate Prisma Client
echo -e "${BLUE}Step 2: Regenerating Prisma Client...${NC}"
if npx prisma generate; then
    echo -e "${GREEN}✓ Prisma Client regenerated successfully${NC}"
else
    echo -e "${RED}✗ Prisma Client generation failed${NC}"
    exit 1
fi
echo ""

# Step 3: Optional seed
if [ "$RUN_SEED" = true ]; then
    echo -e "${BLUE}Step 3: Seeding database...${NC}"
    if npm run db:seed; then
        echo -e "${GREEN}✓ Database seeded successfully${NC}"
    else
        echo -e "${YELLOW}⚠ Seed failed (non-critical)${NC}"
    fi
    echo ""
fi

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Database update completed successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

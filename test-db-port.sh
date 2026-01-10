#!/bin/bash

# Database Port Tester
# Tests common PostgreSQL ports to find the correct one for your cluster

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default ports to test (common PostgreSQL ports)
PORTS=(5432 5433)

# Parse DATABASE_URL if it exists, or use defaults
if [ -f .env ]; then
    source .env
fi

# Extract connection details from DATABASE_URL if available
if [ ! -z "$DATABASE_URL" ]; then
    # Parse DATABASE_URL: postgresql://user:password@host:port/database
    DB_URL="$DATABASE_URL"
    
    # Extract host (everything between @ and :)
    HOST=$(echo "$DB_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    # Extract user (everything between // and :)
    USER=$(echo "$DB_URL" | sed -n 's|.*//\([^:]*\):.*|\1|p')
    # Extract password (everything between user: and @)
    PASSWORD=$(echo "$DB_URL" | sed -n 's|.*//[^:]*:\([^@]*\)@.*|\1|p')
    # Extract database (everything after last /)
    DATABASE=$(echo "$DB_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
    
    echo -e "${YELLOW}Using connection details from DATABASE_URL${NC}"
    echo "Host: $HOST"
    echo "User: $USER"
    echo "Database: $DATABASE"
    echo ""
else
    # Use defaults or prompt
    echo -e "${YELLOW}DATABASE_URL not found. Using interactive mode.${NC}"
    read -p "Enter database host [localhost]: " HOST
    HOST=${HOST:-localhost}
    
    read -p "Enter database user [kontado]: " USER
    USER=${USER:-kontado}
    
    read -sp "Enter database password: " PASSWORD
    echo ""
    
    read -p "Enter database name [kontado]: " DATABASE
    DATABASE=${DATABASE:-kontado}
    echo ""
fi

# Test each port
echo -e "${YELLOW}Testing ports...${NC}"
echo ""

SUCCESS=false
for PORT in "${PORTS[@]}"; do
    echo -n "Testing port $PORT... "
    
    # Test connection using psql if available
    if command -v psql &> /dev/null; then
        export PGPASSWORD="$PASSWORD"
        if psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DATABASE" -c "SELECT version();" &> /dev/null; then
            echo -e "${GREEN}✓ SUCCESS${NC}"
            echo -e "  ${GREEN}Port $PORT is working!${NC}"
            SUCCESS=true
            
            # Show connection details
            echo ""
            echo -e "${GREEN}Working connection string:${NC}"
            echo "postgresql://$USER:$PASSWORD@$HOST:$PORT/$DATABASE?schema=public"
            break
        else
            echo -e "${RED}✗ FAILED${NC}"
        fi
    # Fallback: use nc (netcat) to test if port is open
    elif command -v nc &> /dev/null; then
        if timeout 2 nc -z "$HOST" "$PORT" 2>/dev/null; then
            echo -e "${YELLOW}Port is open (but cannot verify database connection)${NC}"
            echo -e "  ${YELLOW}Install 'psql' for full connection testing${NC}"
        else
            echo -e "${RED}✗ Port is closed or unreachable${NC}"
        fi
    # Fallback: use telnet
    elif command -v telnet &> /dev/null; then
        if timeout 2 bash -c "echo > /dev/tcp/$HOST/$PORT" 2>/dev/null; then
            echo -e "${YELLOW}Port is open (but cannot verify database connection)${NC}"
            echo -e "  ${YELLOW}Install 'psql' for full connection testing${NC}"
        else
            echo -e "${RED}✗ Port is closed or unreachable${NC}"
        fi
    else
        echo -e "${RED}No suitable tool found (psql, nc, or telnet)${NC}"
        break
    fi
done

echo ""
if [ "$SUCCESS" = false ]; then
    echo -e "${RED}None of the tested ports worked.${NC}"
    echo "Please check:"
    echo "  1. Database host is correct: $HOST"
    echo "  2. Database is running and accessible"
    echo "  3. Firewall/network settings allow connections"
    echo "  4. Credentials are correct"
    exit 1
fi

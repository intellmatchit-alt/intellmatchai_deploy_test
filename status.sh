#!/bin/bash
#
# P2P App Status Check
# Quick status overview of all services
#

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                    P2P App Status                          ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# MySQL Status
echo -n "MySQL:        "
if docker exec p2p-mysql mysqladmin ping -h localhost -u p2p_user -pp2p_password --silent 2>/dev/null; then
    echo -e "${GREEN}● Running${NC}"
    connections=$(docker exec p2p-mysql mysql -u p2p_user -pp2p_password -N -e "SHOW STATUS LIKE 'Threads_connected';" 2>/dev/null | awk '{print $2}')
    echo "              Connections: $connections"
else
    echo -e "${RED}● Down${NC}"
fi

# Redis Status
echo -n "Redis:        "
if docker exec p2p-redis redis-cli ping 2>/dev/null | grep -q PONG; then
    echo -e "${GREEN}● Running${NC}"
else
    echo -e "${RED}● Down${NC}"
fi

# Neo4j Status
echo -n "Neo4j:        "
if curl -s http://localhost:7474 > /dev/null 2>&1; then
    echo -e "${GREEN}● Running${NC}"
else
    echo -e "${RED}● Down${NC}"
fi

# MinIO Status
echo -n "MinIO:        "
if curl -s http://localhost:9000/minio/health/live > /dev/null 2>&1; then
    echo -e "${GREEN}● Running${NC}"
else
    echo -e "${RED}● Down${NC}"
fi

echo ""

# Backend Status
echo -n "Backend:      "
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v1/auth/me 2>/dev/null)
if [ "$response" = "401" ] || [ "$response" = "200" ]; then
    echo -e "${GREEN}● Running${NC} (HTTP $response)"
    uptime=$(pm2 jlist 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print([p['pm2_env']['pm_uptime'] for p in d if p['name']=='p2p-backend'][0])" 2>/dev/null)
    if [ -n "$uptime" ]; then
        uptime_human=$(python3 -c "import datetime; print(str(datetime.timedelta(milliseconds=$(date +%s%3N)-$uptime)).split('.')[0])" 2>/dev/null)
        echo "              Uptime: $uptime_human"
    fi
else
    echo -e "${RED}● Down${NC} (HTTP $response)"
fi

# Frontend Status
echo -n "Frontend:     "
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
if [ "$response" = "200" ]; then
    echo -e "${GREEN}● Running${NC}"
else
    echo -e "${RED}● Down${NC} (HTTP $response)"
fi

echo ""
echo -e "${BLUE}───────────────────────────────────────────────────────────${NC}"
echo ""

# System Resources
echo "System Resources:"
echo -n "  CPU:        "
cpu=$(top -bn1 | grep "Cpu(s)" | awk '{print 100 - $8}' | cut -d. -f1)
if [ "$cpu" -lt 80 ]; then
    echo -e "${GREEN}${cpu}%${NC}"
else
    echo -e "${RED}${cpu}%${NC}"
fi

echo -n "  Memory:     "
mem_used=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
mem_available=$(free -h | grep Mem | awk '{print $7}')
if [ "$mem_used" -lt 80 ]; then
    echo -e "${GREEN}${mem_used}% used${NC} ($mem_available available)"
else
    echo -e "${YELLOW}${mem_used}% used${NC} ($mem_available available)"
fi

echo -n "  Disk:       "
disk=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
disk_available=$(df -h / | tail -1 | awk '{print $4}')
if [ "$disk" -lt 80 ]; then
    echo -e "${GREEN}${disk}% used${NC} ($disk_available available)"
else
    echo -e "${YELLOW}${disk}% used${NC} ($disk_available available)"
fi

echo ""
echo -e "${BLUE}───────────────────────────────────────────────────────────${NC}"
echo ""

# Recent Issues
echo "Recent Monitor Logs:"
if [ -f /var/log/p2p-monitor.log ]; then
    tail -5 /var/log/p2p-monitor.log | while read line; do
        if echo "$line" | grep -q "ERROR"; then
            echo -e "  ${RED}$line${NC}"
        elif echo "$line" | grep -q "WARNING"; then
            echo -e "  ${YELLOW}$line${NC}"
        else
            echo "  $line"
        fi
    done
else
    echo "  No logs yet"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

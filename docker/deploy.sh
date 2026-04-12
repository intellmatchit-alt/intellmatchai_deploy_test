#!/bin/bash

# P2P Network - DigitalOcean Deployment Script
# Run this on your DigitalOcean droplet

set -e

echo "=========================================="
echo "P2P Network - Deployment Script"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo)${NC}"
    exit 1
fi

# ===========================================
# Step 1: Update System
# ===========================================
echo -e "${YELLOW}[1/6] Updating system...${NC}"
apt-get update && apt-get upgrade -y

# ===========================================
# Step 2: Install Docker
# ===========================================
echo -e "${YELLOW}[2/6] Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}Docker installed successfully${NC}"
else
    echo -e "${GREEN}Docker already installed${NC}"
fi

# ===========================================
# Step 3: Install Docker Compose
# ===========================================
echo -e "${YELLOW}[3/6] Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}Docker Compose installed successfully${NC}"
else
    echo -e "${GREEN}Docker Compose already installed${NC}"
fi

# ===========================================
# Step 4: Setup Application Directory
# ===========================================
echo -e "${YELLOW}[4/6] Setting up application...${NC}"
APP_DIR="/opt/p2p-network"

if [ ! -d "$APP_DIR" ]; then
    mkdir -p $APP_DIR
fi

# Check if .env exists
if [ ! -f "$APP_DIR/.env" ]; then
    echo -e "${RED}ERROR: .env file not found at $APP_DIR/.env${NC}"
    echo "Please copy .env.production.example to $APP_DIR/.env and configure it"
    exit 1
fi

# ===========================================
# Step 5: Create SSL directory (for future use)
# ===========================================
echo -e "${YELLOW}[5/6] Creating directories...${NC}"
mkdir -p $APP_DIR/nginx/ssl
mkdir -p $APP_DIR/nginx/conf.d

# ===========================================
# Step 6: Start Services
# ===========================================
echo -e "${YELLOW}[6/6] Starting services...${NC}"
cd $APP_DIR

# Pull latest images and start
docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 30

# Check status
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps

echo ""
echo -e "${GREEN}=========================================="
echo "Deployment Complete!"
echo "==========================================${NC}"
echo ""
echo "Your P2P Network is now running at:"
echo "  - Frontend: http://YOUR_SERVER_IP"
echo "  - API: http://YOUR_SERVER_IP/api"
echo ""
echo "Next steps:"
echo "  1. Point your domain to this server's IP"
echo "  2. Setup SSL with: certbot --nginx"
echo "  3. Update .env with your domain URLs"
echo ""

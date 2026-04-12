#!/bin/bash

# =============================================================================
# P2P Network - Migration Restore Script (Run on NEW server)
# =============================================================================
# This script restores the P2P application from backup
# Usage: ./migrate-restore.sh
# Prerequisites: p2p-full-backup.tar.gz must be in /root/
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() { echo -e "\n${BLUE}==>${NC} ${GREEN}$1${NC}"; }
print_info() { echo -e "    ${YELLOW}→${NC} $1"; }
print_success() { echo -e "    ${GREEN}✓${NC} $1"; }
print_error() { echo -e "    ${RED}✗${NC} $1"; }
print_warning() { echo -e "    ${YELLOW}!${NC} $1"; }

BACKUP_FILE="/root/p2p-full-backup.tar.gz"
APP_DIR="/root/p2p-app"

echo ""
echo "=============================================="
echo "  P2P Network - Migration Restore Script"
echo "=============================================="
echo ""

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    print_error "Backup file not found at $BACKUP_FILE"
    print_info "Please transfer the backup file first:"
    echo "    scp /root/p2p-full-backup.tar.gz root@$(curl -s -4 ifconfig.me):/root/"
    exit 1
fi

# =============================================================================
# PHASE 1: System Setup
# =============================================================================

print_step "Phase 1: System Setup"

# Update system
print_info "Updating system packages..."
apt update && apt upgrade -y
print_success "System updated"

# Install essential tools
print_info "Installing essential tools..."
apt install -y curl wget git htop ufw nginx
print_success "Essential tools installed"

# Setup firewall
print_info "Configuring firewall..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw allow 3001/tcp
ufw --force enable
print_success "Firewall configured"

# =============================================================================
# PHASE 2: Install Node.js
# =============================================================================

print_step "Phase 2: Installing Node.js 20"

if command -v node &> /dev/null; then
    print_info "Node.js already installed: $(node -v)"
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    print_success "Node.js installed: $(node -v)"
fi

# =============================================================================
# PHASE 3: Install Docker
# =============================================================================

print_step "Phase 3: Installing Docker"

if command -v docker &> /dev/null; then
    print_info "Docker already installed: $(docker -v)"
else
    curl -fsSL https://get.docker.com | sh
    print_success "Docker installed"
fi

# Install Docker Compose
if command -v docker-compose &> /dev/null; then
    print_info "Docker Compose already installed"
else
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    print_success "Docker Compose installed"
fi

# =============================================================================
# PHASE 4: Install PM2
# =============================================================================

print_step "Phase 4: Installing PM2"

if command -v pm2 &> /dev/null; then
    print_info "PM2 already installed"
else
    npm install -g pm2
    print_success "PM2 installed"
fi

# =============================================================================
# PHASE 5: Extract Backup
# =============================================================================

print_step "Phase 5: Extracting backup"

cd /root

# Extract main backup
print_info "Extracting backup archive..."
tar -xzf "$BACKUP_FILE"
print_success "Backup extracted"

# Extract application code
print_info "Extracting application code..."
tar -xzf /root/migration-backup/p2p-app-code.tar.gz -C /root
print_success "Application code extracted"

# =============================================================================
# PHASE 6: Start Docker Services
# =============================================================================

print_step "Phase 6: Starting Docker services"

cd "$APP_DIR/docker"

# Stop any existing containers
docker-compose down 2>/dev/null || true

# Start services
docker-compose up -d
print_info "Waiting for services to be healthy (60 seconds)..."
sleep 60

# Verify containers are running
if docker ps | grep -q p2p-mysql; then
    print_success "MySQL container running"
else
    print_error "MySQL container failed to start"
    docker logs p2p-mysql
    exit 1
fi

if docker ps | grep -q p2p-redis; then
    print_success "Redis container running"
else
    print_warning "Redis container not running"
fi

if docker ps | grep -q p2p-neo4j; then
    print_success "Neo4j container running"
else
    print_warning "Neo4j container not running"
fi

if docker ps | grep -q p2p-minio; then
    print_success "MinIO container running"
else
    print_warning "MinIO container not running"
fi

# =============================================================================
# PHASE 7: Restore Databases
# =============================================================================

print_step "Phase 7: Restoring databases"

cd /root/migration-backup

# Restore MySQL
print_info "Restoring MySQL database..."
docker exec -i p2p-mysql mysql -u p2p_user -pp2p_password p2p_db < mysql_backup.sql
print_success "MySQL restored"

# Restore Redis
if [ -s redis_backup.rdb ]; then
    print_info "Restoring Redis data..."
    docker cp redis_backup.rdb p2p-redis:/data/dump.rdb
    docker restart p2p-redis
    sleep 5
    print_success "Redis restored"
else
    print_info "No Redis data to restore"
fi

# Restore MinIO
if [ -d minio_backup ] && [ "$(ls -A minio_backup 2>/dev/null)" ]; then
    print_info "Restoring MinIO files..."
    docker cp minio_backup/. p2p-minio:/data/
    docker restart p2p-minio
    sleep 5
    print_success "MinIO restored"
else
    print_info "No MinIO data to restore"
fi

# =============================================================================
# PHASE 8: Build Application
# =============================================================================

print_step "Phase 8: Building application"

# Backend
print_info "Installing backend dependencies..."
cd "$APP_DIR/backend"
npm install
print_success "Backend dependencies installed"

print_info "Generating Prisma client..."
npm run prisma:generate
print_success "Prisma client generated"

print_info "Building backend..."
npm run build
print_success "Backend built"

# Frontend
print_info "Installing frontend dependencies..."
cd "$APP_DIR/frontend"
npm install
print_success "Frontend dependencies installed"

print_info "Building frontend..."
npm run build
print_success "Frontend built"

# =============================================================================
# PHASE 9: Start Application
# =============================================================================

print_step "Phase 9: Starting application"

# Stop any existing PM2 processes
pm2 delete all 2>/dev/null || true

# Start backend
cd "$APP_DIR/backend"
pm2 start npm --name "p2p-backend" -- start
print_success "Backend started on port 3001"

# Start frontend
cd "$APP_DIR/frontend"
pm2 start npm --name "p2p-frontend" -- start
print_success "Frontend started on port 3000"

# Save PM2 configuration
pm2 save
print_success "PM2 configuration saved"

# Setup PM2 startup
pm2 startup systemd -u root --hp /root
print_success "PM2 startup configured"

# =============================================================================
# PHASE 10: Configure Nginx
# =============================================================================

print_step "Phase 10: Configuring Nginx"

# Create Nginx config (without SSL first)
cat > /etc/nginx/sites-available/intellmatch << 'NGINX_EOF'
# Temporary HTTP config (SSL will be added by certbot)
server {
    listen 80;
    server_name intellmatch.com www.intellmatch.com;

    # API routes
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    # Frontend (Next.js)
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

    # File upload size
    client_max_body_size 50M;
}
NGINX_EOF

# Enable site
ln -sf /etc/nginx/sites-available/intellmatch /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
nginx -t
systemctl restart nginx
print_success "Nginx configured"

# =============================================================================
# PHASE 11: Verify Installation
# =============================================================================

print_step "Phase 11: Verifying installation"

# Check PM2 status
echo ""
pm2 status

# Test backend
print_info "Testing backend..."
sleep 5
if curl -s http://localhost:3001/api/v1/health > /dev/null 2>&1; then
    print_success "Backend is responding"
else
    print_warning "Backend health check failed (may need more time)"
fi

# Test frontend
print_info "Testing frontend..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|304"; then
    print_success "Frontend is responding"
else
    print_warning "Frontend may need more time to start"
fi

# =============================================================================
# COMPLETION
# =============================================================================

NEW_IP=$(curl -s -4 ifconfig.me)

echo ""
echo "=============================================="
echo "  Migration Restore Complete!"
echo "=============================================="
echo ""
echo "Server IP: $NEW_IP"
echo ""
echo "Services Running:"
echo "  - Frontend: http://$NEW_IP:3000"
echo "  - Backend:  http://$NEW_IP:3001"
echo "  - MySQL:    localhost:3306"
echo "  - Redis:    localhost:6379"
echo "  - Neo4j:    http://$NEW_IP:7474"
echo "  - MinIO:    http://$NEW_IP:9001"
echo ""
echo "=============================================="
echo "  NEXT STEPS (Manual)"
echo "=============================================="
echo ""
echo "1. UPDATE DNS: Point intellmatch.com to $NEW_IP"
echo "   - Go to your domain registrar"
echo "   - Update A record: intellmatch.com -> $NEW_IP"
echo "   - Update A record: www.intellmatch.com -> $NEW_IP"
echo ""
echo "2. VERIFY DNS (wait for propagation):"
echo "   dig intellmatch.com +short"
echo ""
echo "3. INSTALL SSL (after DNS propagates):"
echo "   apt install -y certbot python3-certbot-nginx"
echo "   certbot --nginx -d intellmatch.com -d www.intellmatch.com"
echo ""
echo "4. TEST the live site:"
echo "   https://intellmatch.com"
echo ""
echo "=============================================="

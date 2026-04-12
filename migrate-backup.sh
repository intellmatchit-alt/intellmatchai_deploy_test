#!/bin/bash

# =============================================================================
# P2P Network - Migration Backup Script (Run on CURRENT server)
# =============================================================================
# This script creates a complete backup of the P2P application
# Usage: ./migrate-backup.sh [NEW_SERVER_IP]
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

# Configuration
BACKUP_DIR="/root/migration-backup"
APP_DIR="/root/p2p-app"
NEW_SERVER_IP="${1:-}"

echo ""
echo "=============================================="
echo "  P2P Network - Migration Backup Script"
echo "=============================================="
echo ""

# Check if running from correct directory
if [ ! -d "$APP_DIR" ]; then
    print_error "App directory not found at $APP_DIR"
    exit 1
fi

# Create backup directory
print_step "Creating backup directory"
rm -rf "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
print_success "Created $BACKUP_DIR"

# Step 1: Document current state
print_step "Documenting current server state"
{
    echo "=== Migration Backup ==="
    echo "Date: $(date)"
    echo "Server IP: $(curl -s -4 ifconfig.me)"
    echo ""
    echo "=== PM2 Status ==="
    pm2 status 2>/dev/null || echo "PM2 not running"
    echo ""
    echo "=== Docker Containers ==="
    docker ps 2>/dev/null || echo "Docker not running"
    echo ""
    echo "=== Disk Usage ==="
    df -h
    echo ""
    echo "=== App Size ==="
    du -sh "$APP_DIR"
} > "$BACKUP_DIR/server-state.txt"
print_success "Server state documented"

# Step 2: Stop application (to ensure consistent backup)
print_step "Stopping application"
cd "$APP_DIR"
pm2 stop all 2>/dev/null || print_info "PM2 not running, continuing..."
print_success "Application stopped"

# Step 3: Export MySQL database
print_step "Exporting MySQL database"
if docker ps | grep -q p2p-mysql; then
    docker exec p2p-mysql mysqldump \
        -u p2p_user \
        -pp2p_password \
        --single-transaction \
        --routines \
        --triggers \
        p2p_db > "$BACKUP_DIR/mysql_backup.sql"
    print_success "MySQL exported ($(du -h "$BACKUP_DIR/mysql_backup.sql" | cut -f1))"
else
    print_error "MySQL container not running!"
    exit 1
fi

# Step 4: Export Redis data
print_step "Exporting Redis data"
if docker ps | grep -q p2p-redis; then
    docker exec p2p-redis redis-cli BGSAVE
    sleep 3
    docker cp p2p-redis:/data/dump.rdb "$BACKUP_DIR/redis_backup.rdb" 2>/dev/null || {
        print_info "No Redis dump found, creating empty placeholder"
        touch "$BACKUP_DIR/redis_backup.rdb"
    }
    print_success "Redis exported"
else
    print_info "Redis container not running, skipping..."
    touch "$BACKUP_DIR/redis_backup.rdb"
fi

# Step 5: Export MinIO files
print_step "Exporting MinIO files"
if docker ps | grep -q p2p-minio; then
    docker cp p2p-minio:/data "$BACKUP_DIR/minio_backup" 2>/dev/null || {
        print_info "No MinIO data found"
        mkdir -p "$BACKUP_DIR/minio_backup"
    }
    print_success "MinIO exported ($(du -sh "$BACKUP_DIR/minio_backup" 2>/dev/null | cut -f1 || echo "0"))"
else
    print_info "MinIO container not running, skipping..."
    mkdir -p "$BACKUP_DIR/minio_backup"
fi

# Step 6: Archive application code
print_step "Archiving application code"
cd /root
tar --exclude='p2p-app/frontend/node_modules' \
    --exclude='p2p-app/backend/node_modules' \
    --exclude='p2p-app/frontend/.next' \
    --exclude='p2p-app/backend/dist' \
    --exclude='p2p-app/.git' \
    -czf "$BACKUP_DIR/p2p-app-code.tar.gz" p2p-app/
print_success "Code archived ($(du -h "$BACKUP_DIR/p2p-app-code.tar.gz" | cut -f1))"

# Step 7: Create final backup bundle
print_step "Creating final backup bundle"
cd /root
tar -czf /root/p2p-full-backup.tar.gz -C /root migration-backup/
BACKUP_SIZE=$(du -h /root/p2p-full-backup.tar.gz | cut -f1)
print_success "Final backup created: /root/p2p-full-backup.tar.gz ($BACKUP_SIZE)"

# Step 8: Restart application
print_step "Restarting application"
cd "$APP_DIR"
pm2 start all 2>/dev/null || print_info "PM2 apps need manual start"
print_success "Application restarted"

# Step 9: Transfer to new server (if IP provided)
if [ -n "$NEW_SERVER_IP" ]; then
    print_step "Transferring backup to new server ($NEW_SERVER_IP)"
    print_info "This may take a few minutes..."
    scp /root/p2p-full-backup.tar.gz "root@$NEW_SERVER_IP:/root/"
    print_success "Backup transferred to new server"
else
    echo ""
    print_info "To transfer backup to new server, run:"
    echo "    scp /root/p2p-full-backup.tar.gz root@NEW_SERVER_IP:/root/"
fi

echo ""
echo "=============================================="
echo "  Backup Complete!"
echo "=============================================="
echo ""
echo "Backup location: /root/p2p-full-backup.tar.gz"
echo "Backup size: $BACKUP_SIZE"
echo ""
echo "Next steps:"
echo "  1. Transfer backup to new server (if not done)"
echo "  2. Run migrate-restore.sh on new server"
echo ""

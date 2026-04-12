#!/bin/bash
# P2P App Migration Backup Script
# Run this on the OLD server

set -e
BACKUP_DIR="/root/p2p-backup-$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

echo "=== Starting Backup ==="

# 1. Backup MySQL Database
echo "1. Backing up MySQL database..."
docker exec p2p-mysql mysqldump -u p2p_user -pp2p_password p2p_db > $BACKUP_DIR/database.sql
echo "   Database saved: $BACKUP_DIR/database.sql"

# 2. Backup Neo4j (if has data)
echo "2. Backing up Neo4j..."
docker exec p2p-neo4j neo4j-admin database dump neo4j --to-path=/tmp/ 2>/dev/null || echo "   Neo4j backup skipped (empty or not supported)"
docker cp p2p-neo4j:/tmp/neo4j.dump $BACKUP_DIR/ 2>/dev/null || echo "   No Neo4j dump to copy"

# 3. Backup MinIO uploads
echo "3. Backing up MinIO uploads..."
docker cp p2p-minio:/data $BACKUP_DIR/minio-data 2>/dev/null || echo "   No MinIO data"

# 4. Backup environment files
echo "4. Backing up config files..."
cp /root/p2p-app/backend/.env $BACKUP_DIR/backend.env
cp /root/p2p-app/frontend/.env.local $BACKUP_DIR/frontend.env.local

# 5. Backup PM2 config
echo "5. Backing up PM2 config..."
pm2 save
cp /root/.pm2/dump.pm2 $BACKUP_DIR/pm2-dump.pm2

# 6. Create archive
echo "6. Creating archive..."
cd /root
tar -czvf p2p-backup.tar.gz p2p-backup-* p2p-app

echo ""
echo "=== Backup Complete ==="
echo "Archive: /root/p2p-backup.tar.gz"
echo "Size: $(du -h /root/p2p-backup.tar.gz | cut -f1)"
echo ""
echo "Next: Copy this file to your NEW server:"
echo "  scp /root/p2p-backup.tar.gz root@NEW_SERVER_IP:/root/"

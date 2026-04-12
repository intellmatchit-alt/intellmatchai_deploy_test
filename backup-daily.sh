#!/bin/bash
# ============================================================
# Daily Database Backup Script
# Backs up MySQL database daily, keeps last 7 days
# Runs via cron: 0 2 * * * /root/p2p-app/backup-daily.sh
# ============================================================

set -euo pipefail

# Configuration
BACKUP_DIR="/root/backups/daily"
MYSQL_CONTAINER="p2p-mysql"
MYSQL_DB="p2p_db"
MYSQL_USER="root"
MYSQL_PASSWORD="rootpassword"
KEEP_DAYS=7
DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
LOG_FILE="/var/log/p2p-backup.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

log "=== Starting daily backup ==="

# ---- MySQL Backup ----
MYSQL_BACKUP="$BACKUP_DIR/p2p-mysql-${TIMESTAMP}.sql.gz"
log "Backing up MySQL database '$MYSQL_DB'..."

if docker exec "$MYSQL_CONTAINER" mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" \
  --single-transaction --routines --triggers --events \
  "$MYSQL_DB" 2>/dev/null | gzip > "$MYSQL_BACKUP"; then

  SIZE=$(du -sh "$MYSQL_BACKUP" | cut -f1)
  log "MySQL backup complete: $MYSQL_BACKUP ($SIZE)"
else
  log "ERROR: MySQL backup failed!"
  rm -f "$MYSQL_BACKUP"
  exit 1
fi

# ---- Redis Backup ----
REDIS_BACKUP="$BACKUP_DIR/p2p-redis-${TIMESTAMP}.rdb"
log "Backing up Redis..."

if docker exec p2p-redis redis-cli -a "your-secure-redis-password" BGSAVE > /dev/null 2>&1; then
  sleep 2
  if docker cp p2p-redis:/data/dump.rdb "$REDIS_BACKUP" 2>/dev/null; then
    SIZE=$(du -sh "$REDIS_BACKUP" | cut -f1)
    log "Redis backup complete: $REDIS_BACKUP ($SIZE)"
  else
    log "WARNING: Redis backup copy failed (non-critical)"
  fi
else
  log "WARNING: Redis BGSAVE failed (non-critical)"
fi

# ---- Cleanup old backups (older than KEEP_DAYS) ----
log "Cleaning up backups older than $KEEP_DAYS days..."

DELETED=0
find "$BACKUP_DIR" -name "p2p-mysql-*.sql.gz" -type f -mtime +$KEEP_DAYS -print -delete 2>/dev/null | while read f; do
  log "Deleted old MySQL backup: $f"
  DELETED=$((DELETED + 1))
done

find "$BACKUP_DIR" -name "p2p-redis-*.rdb" -type f -mtime +$KEEP_DAYS -print -delete 2>/dev/null | while read f; do
  log "Deleted old Redis backup: $f"
done

# ---- Summary ----
TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "p2p-mysql-*.sql.gz" -type f | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
log "Backup complete. Total backups: $TOTAL_BACKUPS, Total size: $TOTAL_SIZE"
log "=== Daily backup finished ==="

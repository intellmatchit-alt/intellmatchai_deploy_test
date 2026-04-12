#!/bin/bash
#
# P2P App Health Monitor
# Monitors MySQL, Backend, Frontend and sends alerts on failure
#
# Usage: ./monitor.sh
# Cron: * * * * * /root/p2p-app/monitor.sh
#

# Configuration
APP_DIR="/root/p2p-app"
LOG_FILE="/var/log/p2p-monitor.log"
ALERT_COOLDOWN_FILE="/tmp/p2p-alert-cooldown"
ALERT_COOLDOWN_SECONDS=300  # Don't send alerts more than once per 5 minutes

# Load configuration from file
CONFIG_FILE="$APP_DIR/monitor.conf"
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

# Alert Configuration (can be overridden in monitor.conf)
ALERT_EMAIL="${ALERT_EMAIL:-}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Timestamp
timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

# Log message
log() {
    echo "$(timestamp): $1" >> "$LOG_FILE"
}

# Send alert via all configured channels
send_alert() {
    local subject="$1"
    local message="$2"
    local alert_sent=false

    # Check cooldown to prevent alert spam
    if [ -f "$ALERT_COOLDOWN_FILE" ]; then
        last_alert=$(cat "$ALERT_COOLDOWN_FILE")
        now=$(date +%s)
        diff=$((now - last_alert))
        if [ $diff -lt $ALERT_COOLDOWN_SECONDS ]; then
            log "Alert cooldown active, skipping alert: $subject"
            return
        fi
    fi

    # Email alert
    if [ -n "$ALERT_EMAIL" ]; then
        echo "$message" | mail -s "[P2P Alert] $subject" "$ALERT_EMAIL" 2>/dev/null && alert_sent=true
        log "Email alert sent to $ALERT_EMAIL"
    fi

    # Telegram alert
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID}" \
            -d "text=🚨 *P2P Alert*: ${subject}%0A%0A${message}" \
            -d "parse_mode=Markdown" > /dev/null 2>&1 && alert_sent=true
        log "Telegram alert sent"
    fi

    # Slack alert
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -s -X POST "$SLACK_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"🚨 *P2P Alert*: ${subject}\n${message}\"}" > /dev/null 2>&1 && alert_sent=true
        log "Slack alert sent"
    fi

    # Discord alert
    if [ -n "$DISCORD_WEBHOOK_URL" ]; then
        curl -s -X POST "$DISCORD_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"content\":\"🚨 **P2P Alert**: ${subject}\n${message}\"}" > /dev/null 2>&1 && alert_sent=true
        log "Discord alert sent"
    fi

    # Update cooldown
    if [ "$alert_sent" = true ]; then
        date +%s > "$ALERT_COOLDOWN_FILE"
    fi
}

# Send recovery notification
send_recovery() {
    local subject="$1"
    local message="$2"

    # Telegram recovery
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID}" \
            -d "text=✅ *P2P Recovery*: ${subject}%0A%0A${message}" \
            -d "parse_mode=Markdown" > /dev/null 2>&1
    fi

    # Slack recovery
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -s -X POST "$SLACK_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"✅ *P2P Recovery*: ${subject}\n${message}\"}" > /dev/null 2>&1
    fi

    # Discord recovery
    if [ -n "$DISCORD_WEBHOOK_URL" ]; then
        curl -s -X POST "$DISCORD_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"content\":\"✅ **P2P Recovery**: ${subject}\n${message}\"}" > /dev/null 2>&1
    fi

    # Clear cooldown on recovery
    rm -f "$ALERT_COOLDOWN_FILE"
}

# Check MySQL
check_mysql() {
    if docker exec p2p-mysql mysqladmin ping -h localhost -u p2p_user -pp2p_password --silent 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Check Backend API
check_backend() {
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v1/auth/me 2>/dev/null)
    # 401 is expected (no auth), 5xx is bad
    if [ "$response" = "401" ] || [ "$response" = "200" ]; then
        return 0
    else
        return 1
    fi
}

# Check Frontend
check_frontend() {
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
    if [ "$response" = "200" ]; then
        return 0
    else
        return 1
    fi
}

# Check disk space
check_disk() {
    usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$usage" -lt 90 ]; then
        return 0
    else
        return 1
    fi
}

# Check memory
check_memory() {
    available=$(free | grep Mem | awk '{print int($7/$2 * 100)}')
    if [ "$available" -gt 10 ]; then
        return 0
    else
        return 1
    fi
}

# Auto-fix MySQL
fix_mysql() {
    log "Attempting MySQL auto-fix..."
    cd "$APP_DIR/docker" && docker-compose restart mysql
    sleep 10
    if check_mysql; then
        log "MySQL recovered after restart"
        pm2 restart p2p-backend
        send_recovery "MySQL Recovered" "MySQL was automatically restarted and is now healthy."
        return 0
    else
        log "MySQL still failing after restart"
        return 1
    fi
}

# Auto-fix Backend
fix_backend() {
    log "Attempting Backend auto-fix..."
    pm2 restart p2p-backend
    sleep 5
    if check_backend; then
        log "Backend recovered after restart"
        send_recovery "Backend Recovered" "Backend was automatically restarted and is now healthy."
        return 0
    else
        log "Backend still failing after restart"
        return 1
    fi
}

# Auto-fix Frontend
fix_frontend() {
    log "Attempting Frontend auto-fix..."
    pm2 restart p2p-frontend
    sleep 5
    if check_frontend; then
        log "Frontend recovered after restart"
        send_recovery "Frontend Recovered" "Frontend was automatically restarted and is now healthy."
        return 0
    else
        log "Frontend still failing after restart"
        return 1
    fi
}

# Main monitoring logic
main() {
    local has_issues=false
    local issues=""

    # Check MySQL
    if ! check_mysql; then
        log "ERROR: MySQL is not responding"
        has_issues=true
        issues="${issues}❌ MySQL is DOWN\n"

        # Try to fix
        if ! fix_mysql; then
            send_alert "MySQL Critical" "MySQL is not responding and auto-recovery failed. Manual intervention required.\n\nServer: $(hostname)\nTime: $(timestamp)"
        fi
    fi

    # Check Backend
    if ! check_backend; then
        log "ERROR: Backend API is not responding"
        has_issues=true
        issues="${issues}❌ Backend API is DOWN\n"

        # Try to fix
        if ! fix_backend; then
            send_alert "Backend Critical" "Backend API is not responding and auto-recovery failed.\n\nServer: $(hostname)\nTime: $(timestamp)"
        fi
    fi

    # Check Frontend
    if ! check_frontend; then
        log "ERROR: Frontend is not responding"
        has_issues=true
        issues="${issues}❌ Frontend is DOWN\n"

        # Try to fix
        if ! fix_frontend; then
            send_alert "Frontend Critical" "Frontend is not responding and auto-recovery failed.\n\nServer: $(hostname)\nTime: $(timestamp)"
        fi
    fi

    # Check Disk
    if ! check_disk; then
        log "WARNING: Disk space is low"
        has_issues=true
        disk_usage=$(df -h / | tail -1 | awk '{print $5}')
        issues="${issues}⚠️ Disk space low: ${disk_usage}\n"
        send_alert "Disk Space Warning" "Disk usage is at ${disk_usage}. Please free up space.\n\nServer: $(hostname)"
    fi

    # Check Memory
    if ! check_memory; then
        log "WARNING: Memory is low"
        has_issues=true
        mem_available=$(free -h | grep Mem | awk '{print $7}')
        issues="${issues}⚠️ Memory low: ${mem_available} available\n"
        send_alert "Memory Warning" "Available memory is low: ${mem_available}. Consider restarting services.\n\nServer: $(hostname)"
    fi

    # Log status
    if [ "$has_issues" = false ]; then
        log "OK: All services healthy"
    fi
}

# Run main
main

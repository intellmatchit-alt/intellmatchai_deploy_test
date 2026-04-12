#!/bin/bash
# Check if MySQL is responding, restart if not
if ! docker exec p2p-mysql mysqladmin ping -h localhost -u p2p_user -pp2p_password --silent 2>/dev/null; then
    echo "$(date): MySQL not responding, restarting..." >> /var/log/mysql-health.log
    docker-compose restart mysql
    sleep 5
    pm2 restart p2p-backend
fi

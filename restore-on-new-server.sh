#!/bin/bash
# P2P App Migration Restore Script
# Run this on the NEW server

set -e

echo "=== P2P App Migration - New Server Setup ==="
echo ""

# Check if backup exists
if [ ! -f /root/p2p-backup.tar.gz ]; then
    echo "ERROR: /root/p2p-backup.tar.gz not found!"
    echo "Please copy the backup from old server first:"
    echo "  scp root@OLD_SERVER:/root/p2p-backup.tar.gz /root/"
    exit 1
fi

# 1. Install dependencies
echo "1. Installing dependencies..."
apt update
apt install -y curl git docker.io docker-compose nginx certbot python3-certbot-nginx

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2
npm install -g pm2

# Start Docker
systemctl enable docker
systemctl start docker

# 2. Extract backup
echo "2. Extracting backup..."
cd /root
tar -xzvf p2p-backup.tar.gz

# 3. Start Docker services
echo "3. Starting Docker services..."
cd /root/p2p-app/docker
docker-compose up -d

echo "   Waiting for MySQL to be ready..."
sleep 30

# 4. Restore MySQL database
echo "4. Restoring MySQL database..."
BACKUP_DIR=$(ls -d /root/p2p-backup-* | head -1)
docker exec -i p2p-mysql mysql -u p2p_user -pp2p_password p2p_db < $BACKUP_DIR/database.sql

# 5. Restore MinIO data
echo "5. Restoring MinIO uploads..."
if [ -d "$BACKUP_DIR/minio-data" ]; then
    docker cp $BACKUP_DIR/minio-data/. p2p-minio:/data/
fi

# 6. Restore config files
echo "6. Restoring config files..."
cp $BACKUP_DIR/backend.env /root/p2p-app/backend/.env
cp $BACKUP_DIR/frontend.env.local /root/p2p-app/frontend/.env.local

# 7. Install dependencies and build
echo "7. Installing Node dependencies..."
cd /root/p2p-app/backend
npm install
npx prisma generate

cd /root/p2p-app/frontend
npm install

# 8. Build frontend
echo "8. Building frontend..."
npm run build

# 9. Start services with PM2
echo "9. Starting services..."
cd /root/p2p-app/backend
pm2 start npm --name "p2p-backend" -- start

cd /root/p2p-app/frontend/.next/standalone
pm2 start server.js --name "p2p-frontend" -i 1

pm2 save
pm2 startup

# 10. Setup Nginx
echo "10. Setting up Nginx..."
cat > /etc/nginx/sites-available/intellmatch << 'NGINX'
server {
    listen 80;
    server_name intellmatch.com www.intellmatch.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/intellmatch /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "=== Migration Complete ==="
echo ""
echo "Next steps:"
echo "1. Update DNS: Point intellmatch.com to this server's IP"
echo "2. Setup SSL:  certbot --nginx -d intellmatch.com -d www.intellmatch.com"
echo "3. Test site:  curl http://localhost:3000"
echo ""
echo "Services status:"
pm2 status

# Deploy P2P Network to DigitalOcean

## Quick Start (5 Steps)

### Step 1: Create DigitalOcean Droplet

1. Go to [DigitalOcean](https://www.digitalocean.com/) (new users get **$200 free credit**)
2. Create a new Droplet:
   - **Image**: Ubuntu 22.04 LTS
   - **Size**: Basic $12/mo (1 vCPU, 2GB RAM) - minimum recommended
   - **Region**: Choose closest to your users
   - **Authentication**: SSH Key (recommended) or Password

### Step 2: Connect to Your Server

```bash
ssh root@YOUR_SERVER_IP
```

### Step 3: Upload Your Project

**Option A: Using Git (Recommended)**
```bash
# On your server
cd /opt
git clone https://github.com/YOUR_USERNAME/p2p-network.git
cd p2p-network/docker
```

**Option B: Using SCP (from your local machine)**
```bash
# On your LOCAL machine (Windows PowerShell or Git Bash)
scp -r "C:\Users\User\Desktop\p2p system\p2p-app" root@YOUR_SERVER_IP:/opt/p2p-network
```

### Step 4: Configure Environment

```bash
# On your server
cd /opt/p2p-network/docker

# Copy and edit the environment file
cp .env.production.example .env
nano .env   # or use: vi .env
```

**Important**: Generate secure passwords:
```bash
# Generate JWT secrets
openssl rand -base64 64  # Use for JWT_SECRET
openssl rand -base64 64  # Use for JWT_REFRESH_SECRET

# Generate strong passwords for databases
openssl rand -base64 32  # Use for MYSQL_PASSWORD, REDIS_PASSWORD, etc.
```

### Step 5: Deploy

```bash
# Make deploy script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

---

## Manual Deployment (Alternative)

If you prefer manual setup:

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker

# 2. Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 3. Navigate to docker directory
cd /opt/p2p-network/docker

# 4. Start all services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## After Deployment

### Check Services Status
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f frontend
```

### Run Database Migrations
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

---

## Setup SSL (Free with Let's Encrypt)

### Step 1: Point Domain to Server
- Add an A record in your domain's DNS pointing to your server IP
- Wait for DNS propagation (5-30 minutes)

### Step 2: Install Certbot
```bash
apt install certbot python3-certbot-nginx -y
```

### Step 3: Get Certificate
```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Step 4: Auto-renewal (automatic)
Certbot sets up auto-renewal. Test with:
```bash
certbot renew --dry-run
```

---

## Useful Commands

```bash
# Stop all services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# Restart a service
docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart backend

# Rebuild and restart
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# View resource usage
docker stats

# Clean up unused images
docker system prune -a
```

---

## Troubleshooting

### Port already in use
```bash
# Check what's using port 80
lsof -i :80
# Kill if needed
kill -9 <PID>
```

### Database connection issues
```bash
# Check if MySQL is running
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs mysql

# Connect to MySQL
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec mysql mysql -u root -p
```

### Out of memory
- Upgrade to a larger droplet, or
- Reduce resource limits in docker-compose.prod.yml

---

## Estimated Costs

| Resource | Free Tier | Paid |
|----------|-----------|------|
| DigitalOcean | $200 credit (60 days) | $12-24/mo |
| Domain | - | $10-15/year |
| SSL | Free (Let's Encrypt) | Free |

**Total**: Free for 60 days, then ~$12-24/month

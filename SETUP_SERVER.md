# P2P Network - Server Setup Guide

This guide helps set up the P2P Network application on a fresh Ubuntu server (DigitalOcean Droplet).

## Quick Start (Recommended)

Run this single command to set up everything automatically:

```bash
chmod +x setup.sh && ./setup.sh
```

## Manual Setup

### Step 1: Install Required Software

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Git
sudo apt install -y git

# Logout and login again for docker group to take effect
```

### Step 2: Project Structure

```
p2p-app/
├── frontend/          # Next.js 14 PWA (Port 3000)
├── backend/           # Express.js API (Port 3001)
├── docker/            # Docker configuration
│   ├── docker-compose.yml        # Development services
│   ├── docker-compose.prod.yml   # Production override
│   └── nginx/nginx.conf          # Nginx reverse proxy
└── .env.example       # Environment template
```

### Step 3: Start Database Services

```bash
cd p2p-app/docker

# Start MySQL, Redis, Neo4j, MinIO
docker-compose up -d

# Verify services are running
docker-compose ps
```

Services started:
- **MySQL**: Port 3306 (Database)
- **Redis**: Port 6379 (Cache & Sessions)
- **Neo4j**: Port 7474/7687 (Graph Database)
- **MinIO**: Port 9000/9001 (File Storage)

### Step 4: Configure Environment

```bash
cd p2p-app/backend

# Copy environment template
cp ../.env.example .env

# Edit environment file
nano .env
```

**Required Environment Variables:**

```env
# Database (Docker default)
DATABASE_URL="mysql://p2p_user:p2p_password@localhost:3306/p2p_db"

# Redis
REDIS_URL="redis://localhost:6379"

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=neo4jpassword

# JWT Secrets (CHANGE THESE!)
JWT_SECRET=generate-a-random-64-char-string
JWT_REFRESH_SECRET=generate-another-random-64-char-string

# Server
PORT=3001
NODE_ENV=production

# AI Services (Optional - add if you have keys)
OPENAI_API_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=
```

Generate random secrets:
```bash
openssl rand -base64 64
```

### Step 5: Setup Backend

```bash
cd p2p-app/backend

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed initial data (optional)
npm run prisma:seed

# Build for production
npm run build

# Start backend
npm start
# OR for development:
npm run dev
```

### Step 6: Setup Frontend

```bash
cd p2p-app/frontend

# Install dependencies
npm install

# Create environment file
echo "NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1" > .env.local

# Build for production
npm run build

# Start frontend
npm start
# OR for development:
npm run dev
```

### Step 7: Setup Nginx (Production)

```bash
# Install Nginx
sudo apt install -y nginx

# Copy nginx config
sudo cp p2p-app/docker/nginx/nginx.conf /etc/nginx/sites-available/p2p

# Enable site
sudo ln -s /etc/nginx/sites-available/p2p /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 8: Setup Process Manager (PM2)

```bash
# Install PM2
sudo npm install -g pm2

# Start backend
cd p2p-app/backend
pm2 start npm --name "p2p-backend" -- start

# Start frontend
cd ../frontend
pm2 start npm --name "p2p-frontend" -- start

# Save PM2 config
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### Step 9: Setup SSL (Optional but Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is configured automatically
```

## Docker Production Deployment (Alternative)

If you prefer Docker for everything:

```bash
cd p2p-app/docker

# Copy production env
cp .env.production.example .env

# Edit environment variables
nano .env

# Start all services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# View logs
docker-compose logs -f
```

## Useful Commands

### Check Service Status
```bash
# Docker services
docker-compose ps

# PM2 processes
pm2 status

# Nginx status
sudo systemctl status nginx
```

### View Logs
```bash
# Backend logs
pm2 logs p2p-backend

# Frontend logs
pm2 logs p2p-frontend

# Docker logs
docker-compose logs -f mysql
docker-compose logs -f redis
```

### Restart Services
```bash
# Restart backend
pm2 restart p2p-backend

# Restart frontend
pm2 restart p2p-frontend

# Restart all Docker services
docker-compose restart
```

### Database Commands
```bash
# Access MySQL
docker exec -it p2p-mysql mysql -u p2p_user -p p2p_db

# Run new migrations
cd backend && npm run prisma:migrate

# Reset database (WARNING: deletes all data)
npm run prisma:migrate reset
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port
sudo lsof -i :3000
sudo lsof -i :3001

# Kill process
sudo kill -9 <PID>
```

### Docker Permission Denied
```bash
sudo usermod -aG docker $USER
# Then logout and login again
```

### MySQL Connection Refused
```bash
# Check if MySQL is running
docker-compose ps mysql

# Restart MySQL
docker-compose restart mysql

# Check MySQL logs
docker-compose logs mysql
```

### Frontend Build Fails
```bash
# Clear cache and rebuild
cd frontend
rm -rf .next node_modules
npm install
npm run build
```

## Firewall Configuration

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Allow SSH
sudo ufw allow 22

# Enable firewall
sudo ufw enable
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/register` | POST | User registration |
| `/api/v1/auth/login` | POST | User login |
| `/api/v1/auth/refresh` | POST | Refresh token |
| `/api/v1/contacts` | GET | List contacts |
| `/api/v1/contacts` | POST | Create contact |
| `/api/v1/contacts/:id` | GET | Get contact |
| `/api/v1/scan/card` | POST | Scan business card |
| `/api/v1/matches` | GET | Get AI matches |
| `/api/v1/graph/network` | GET | Get network graph |

## Technology Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Express.js, TypeScript, Prisma ORM
- **Database**: MySQL 8.0
- **Cache**: Redis
- **Graph DB**: Neo4j
- **Storage**: MinIO (S3-compatible)
- **AI**: OpenAI, Groq, Gemini (optional)

## Support

For issues, check:
1. Service logs (`pm2 logs`, `docker-compose logs`)
2. Environment variables are set correctly
3. All ports are available and not blocked by firewall

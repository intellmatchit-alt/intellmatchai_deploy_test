#!/bin/bash

# P2P Network - Automated Server Setup Script
# Run this script on a fresh Ubuntu server to set up the entire application

set -e

echo "========================================"
echo "  P2P Network - Server Setup"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root. Some commands will be adjusted."
    SUDO=""
else
    SUDO="sudo"
fi

echo ""
echo "Step 1: Updating System..."
echo "----------------------------------------"
$SUDO apt update && $SUDO apt upgrade -y
print_status "System updated"

echo ""
echo "Step 2: Installing Node.js 20..."
echo "----------------------------------------"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_status "Node.js already installed: $NODE_VERSION"
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
    $SUDO apt-get install -y nodejs
    print_status "Node.js installed: $(node -v)"
fi

echo ""
echo "Step 3: Installing Docker..."
echo "----------------------------------------"
if command -v docker &> /dev/null; then
    print_status "Docker already installed"
else
    curl -fsSL https://get.docker.com | sh
    $SUDO usermod -aG docker $USER
    print_status "Docker installed"
    print_warning "You may need to logout and login for Docker group to take effect"
fi

echo ""
echo "Step 4: Installing Docker Compose..."
echo "----------------------------------------"
if command -v docker-compose &> /dev/null; then
    print_status "Docker Compose already installed"
else
    $SUDO curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    $SUDO chmod +x /usr/local/bin/docker-compose
    print_status "Docker Compose installed"
fi

echo ""
echo "Step 5: Installing PM2..."
echo "----------------------------------------"
if command -v pm2 &> /dev/null; then
    print_status "PM2 already installed"
else
    $SUDO npm install -g pm2
    print_status "PM2 installed"
fi

echo ""
echo "Step 6: Starting Docker Services..."
echo "----------------------------------------"
cd "$SCRIPT_DIR/docker"
docker-compose up -d
print_status "Docker services started (MySQL, Redis, Neo4j, MinIO)"

# Wait for MySQL to be ready
echo "Waiting for MySQL to be ready..."
sleep 10

echo ""
echo "Step 7: Setting up Backend..."
echo "----------------------------------------"
cd "$SCRIPT_DIR/backend"

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    if [ -f ../.env.example ]; then
        cp ../.env.example .env
        print_status "Created .env from template"
    else
        cat > .env << 'EOF'
# Database
DATABASE_URL="mysql://p2p_user:p2p_password@localhost:3306/p2p_db"

# Redis
REDIS_URL="redis://localhost:6379"

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=neo4jpassword

# JWT (CHANGE THESE IN PRODUCTION!)
JWT_SECRET=change-this-to-a-random-64-character-string-for-production-use
JWT_REFRESH_SECRET=change-this-to-another-random-64-character-string

# Server
PORT=3001
NODE_ENV=production

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# AI Services (Optional)
OPENAI_API_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=
EOF
        print_status "Created default .env file"
        print_warning "Please update JWT secrets in backend/.env for production!"
    fi
else
    print_status ".env file already exists"
fi

# Install backend dependencies
echo "Installing backend dependencies..."
npm install
print_status "Backend dependencies installed"

# Generate Prisma client
echo "Generating Prisma client..."
npm run prisma:generate
print_status "Prisma client generated"

# Run migrations
echo "Running database migrations..."
npm run prisma:migrate || {
    print_warning "Migration failed, trying to push schema..."
    npx prisma db push
}
print_status "Database schema applied"

# Build backend
echo "Building backend..."
npm run build
print_status "Backend built"

echo ""
echo "Step 8: Setting up Frontend..."
echo "----------------------------------------"
cd "$SCRIPT_DIR/frontend"

# Create frontend .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo "NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1" > .env.local
    print_status "Created frontend .env.local"
else
    print_status "Frontend .env.local already exists"
fi

# Install frontend dependencies
echo "Installing frontend dependencies..."
npm install
print_status "Frontend dependencies installed"

# Build frontend
echo "Building frontend..."
npm run build
print_status "Frontend built"

echo ""
echo "Step 9: Starting Applications with PM2..."
echo "----------------------------------------"

# Stop existing processes if any
pm2 delete p2p-backend 2>/dev/null || true
pm2 delete p2p-frontend 2>/dev/null || true

# Start backend
cd "$SCRIPT_DIR/backend"
pm2 start npm --name "p2p-backend" -- start
print_status "Backend started on port 3001"

# Start frontend
cd "$SCRIPT_DIR/frontend"
pm2 start npm --name "p2p-frontend" -- start
print_status "Frontend started on port 3000"

# Save PM2 config
pm2 save
print_status "PM2 configuration saved"

echo ""
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "Services Running:"
echo "  - Frontend: http://localhost:3000"
echo "  - Backend:  http://localhost:3001"
echo "  - MySQL:    localhost:3306"
echo "  - Redis:    localhost:6379"
echo "  - Neo4j:    http://localhost:7474"
echo "  - MinIO:    http://localhost:9001"
echo ""
echo "Useful Commands:"
echo "  pm2 status          - Check app status"
echo "  pm2 logs            - View logs"
echo "  pm2 restart all     - Restart apps"
echo "  docker-compose ps   - Check Docker services"
echo ""
print_warning "Remember to update JWT secrets in backend/.env for production!"
print_warning "Consider setting up Nginx and SSL for production use."
echo ""
echo "See SETUP_SERVER.md for more detailed instructions."

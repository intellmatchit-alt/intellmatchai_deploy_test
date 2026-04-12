#!/bin/bash

# =============================================================================
# P2P Network - SSL Setup Script (Run AFTER DNS points to new server)
# =============================================================================
# This script installs SSL certificates using Let's Encrypt
# Usage: ./migrate-ssl.sh [email]
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

DOMAIN="intellmatch.com"
EMAIL="${1:-osama.alasasfah@gmail.com}"
SERVER_IP=$(curl -s -4 ifconfig.me)

echo ""
echo "=============================================="
echo "  P2P Network - SSL Setup"
echo "=============================================="
echo ""

# Check DNS
print_step "Checking DNS configuration"

DNS_IP=$(dig +short "$DOMAIN" | head -1)

if [ "$DNS_IP" = "$SERVER_IP" ]; then
    print_success "DNS is correctly pointing to this server ($SERVER_IP)"
else
    print_error "DNS mismatch!"
    print_info "Domain $DOMAIN points to: $DNS_IP"
    print_info "This server IP is: $SERVER_IP"
    echo ""
    print_info "Please update DNS first, then run this script again."
    print_info "DNS propagation can take 5-30 minutes."
    echo ""
    print_info "Check propagation at: https://dnschecker.org/#A/$DOMAIN"
    exit 1
fi

# Install certbot
print_step "Installing Certbot"
apt install -y certbot python3-certbot-nginx
print_success "Certbot installed"

# Get SSL certificate
print_step "Obtaining SSL certificate"
certbot --nginx \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --redirect

print_success "SSL certificate installed"

# Setup auto-renewal
print_step "Setting up auto-renewal"
systemctl enable certbot.timer
systemctl start certbot.timer
print_success "Auto-renewal configured"

# Restart Nginx
print_step "Restarting Nginx"
systemctl restart nginx
print_success "Nginx restarted"

# Test SSL
print_step "Testing SSL"
sleep 3
if curl -sI "https://$DOMAIN" | grep -q "200\|301\|302"; then
    print_success "SSL is working!"
else
    print_info "SSL may need a moment to take effect"
fi

echo ""
echo "=============================================="
echo "  SSL Setup Complete!"
echo "=============================================="
echo ""
echo "Your site is now available at:"
echo "  https://$DOMAIN"
echo "  https://www.$DOMAIN"
echo ""
echo "Certificate will auto-renew before expiry."
echo ""

#!/bin/bash
# This artifact contains the deployment structure for zerogex-web
# Create these files in your zerogex-web/deploy/ directory

# ==============================================
# FILE: deploy/deploy.sh
# ==============================================
cat > deploy.sh << 'DEPLOY_SCRIPT'
#!/bin/bash

# ==============================================
# ZeroGEX Web Platform Deployment Script
# ==============================================

set -e  # Exit on any error

# Export HOME
[ -z "$HOME" ] && export HOME="/home/ubuntu"

# Variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STEPS_DIR="$SCRIPT_DIR/steps"
LOG_DIR="${HOME}/logs"
LOG_FILE="${LOG_DIR}/web_deployment_$(date +%Y%m%d_%H%M%S).log"

# Help text
show_help() {
    cat << EOF
ZeroGEX Web Platform Deployment Script

Usage: ./deploy.sh [OPTIONS]

Options:
  --start-from STEP    Start deployment from a specific step
                       STEP can be a step number (e.g., 020) or name (e.g., nodejs)
  -h, --help          Show this help message

Examples:
  ./deploy.sh                        # Run full deployment (all steps)
  ./deploy.sh --start-from 020       # Start from step 020
  ./deploy.sh --start-from nodejs    # Start from Node.js step
  ./deploy.sh --start-from nginx     # Start from nginx step

Available Steps:
EOF

    for step in $(ls -1 $STEPS_DIR/*.* 2>/dev/null); do
        desc=$(grep "# Step" "$step" | head -1 | awk -F: '{print $2}')
        printf "%s\t%s\n" "$(basename $step)" "- $desc"
    done

    echo
    echo "Logs are saved to: ${LOG_DIR}/web_deployment_YYYYMMDD_HHMMSS.log"
    echo

    exit 0
}

# Parse command line arguments
START_FROM=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --start-from)
            START_FROM="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Create logs directory if it doesn't exist
[ ! -d "$LOG_DIR" ] && mkdir -p "$LOG_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Export log function for sub-steps
export -f log
export LOG_FILE

log "=========================================="
log "🚀 Deploying ZeroGEX Web Platform..."
if [ -n "$START_FROM" ]; then
    log "Starting from step: $START_FROM"
fi
log "=========================================="

# Flag to track if we should start executing
SHOULD_EXECUTE=false
if [ -z "$START_FROM" ]; then
    SHOULD_EXECUTE=true
fi

# Execute each step in order
for step_script in "$STEPS_DIR"/*.* ; do
    if [ -x "$step_script" ]; then
        step_name=$(basename "$step_script")

        # Check if this is the start-from step
        if [ -n "$START_FROM" ] && [[ "$step_name" == *"$START_FROM"* ]]; then
            SHOULD_EXECUTE=true
            log "Found start step: $step_name"
        fi

        # Skip steps before the start-from step
        if [ "$SHOULD_EXECUTE" = false ]; then
            log "Skipping: $step_name"
            continue
        fi

        log "=========================================="
        log "Executing: $step_name ..."

        if bash "$step_script"; then
            log "✓ $step_name completed successfully"
        else
            log "✗ $step_name failed"
            exit 1
        fi
        log ""
    fi
done

log ""
log "=========================================="
log "✅ Deployment Complete!"
log "=========================================="
log "Log file: $LOG_FILE"
DEPLOY_SCRIPT

chmod +x deploy.sh

# ==============================================
# FILE: deploy/steps/010.setup
# ==============================================
mkdir -p steps
cat > steps/010.setup << 'STEP010'
#!/bin/bash

# ==============================================
# Step 010: System Setup and Basic Configuration
# ==============================================

set -e

log "System Setup and Basic Configuration"

# Update system
log "  → Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
sudo apt update && sudo apt upgrade -y

# Install essential tools
log "  → Installing essential tools..."
sudo apt install -y \
    git \
    curl \
    wget \
    build-essential \
    jq \
    htop \
    vim \
    nginx

# Update timezone
log "  → Setting timezone to America/New_York..."
sudo timedatectl set-timezone America/New_York

# Verify timezone update
log "  → Verifying timezone..."
log "     Current time: $(date)"

log "System setup complete!"
log ""
log "Summary:"
log "  ✓ System packages updated"
log "  ✓ Essential tools installed"
log "  ✓ Nginx installed"
log "  ✓ Timezone set to America/New_York"
log ""
STEP010

chmod +x steps/010.setup

# ==============================================
# FILE: deploy/steps/020.nodejs
# ==============================================
cat > steps/020.nodejs << 'STEP020'
#!/bin/bash

# ==============================================
# Step 020: Node.js Installation
# ==============================================

set -e

log "Node.js Installation"

# Check if nvm is already installed
if [ -d "$HOME/.nvm" ]; then
    log "  ℹ nvm already installed, skipping installation..."
else
    log "  → Installing nvm (Node Version Manager)..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    
    log "  → Loading nvm..."
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Load nvm if not already loaded
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js 20
log "  → Installing Node.js 20..."
nvm install 20
nvm use 20
nvm alias default 20

# Verify installation
NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)

log ""
log "Node.js installation complete!"
log ""
log "Summary:"
log "  ✓ nvm installed"
log "  ✓ Node.js version: $NODE_VERSION"
log "  ✓ npm version: $NPM_VERSION"
log ""
STEP020

chmod +x steps/020.nodejs

# ==============================================
# FILE: deploy/steps/030.application
# ==============================================
cat > steps/030.application << 'STEP030'
#!/bin/bash

# ==============================================
# Step 030: Application Setup
# ==============================================

set -e

log "Application Setup"

# Define application directory
APP_DIR="$HOME/zerogex-web"

# Check if application directory already exists
if [ -d "$APP_DIR" ]; then
    log "  → Application directory exists, pulling latest changes..."
    cd "$APP_DIR"
    git pull
else
    log "  → Cloning repository..."
    cd "$HOME"
    
    # Prompt for git repository URL
    read -p "  Enter git repository URL: " GIT_REPO
    while [ -z "$GIT_REPO" ]; do
        echo "     ✗ Repository URL cannot be empty"
        read -p "  Enter git repository URL: " GIT_REPO
    done
    
    git clone "$GIT_REPO" zerogex-web
    cd "$APP_DIR"
fi

# Navigate to frontend directory
log "  → Navigating to frontend directory..."
cd "$APP_DIR/frontend"

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use Node 20
nvm use 20

# Install dependencies
log "  → Installing npm dependencies..."
npm install

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    log "  → Creating .env.local file..."
    cat > .env.local << 'EOF'
# API Configuration (when backend is ready)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws

# Feature Flags
NEXT_PUBLIC_ENABLE_WEBSOCKET=false
NEXT_PUBLIC_ENABLE_GRAFANA=false
EOF
    chmod 600 .env.local
    log "     ✓ .env.local created"
else
    log "     ℹ .env.local already exists"
fi

# Build for production
log "  → Building application for production..."
npm run build

log ""
log "Application setup complete!"
log ""
log "Summary:"
log "  ✓ Repository cloned/updated"
log "  ✓ Dependencies installed"
log "  ✓ Production build created"
log "  ✓ .env.local configured"
log ""
STEP030

chmod +x steps/030.application

# ==============================================
# FILE: deploy/steps/040.pm2
# ==============================================
cat > steps/040.pm2 << 'STEP040'
#!/bin/bash

# ==============================================
# Step 040: PM2 Process Manager Setup
# ==============================================

set -e

log "PM2 Process Manager Setup"

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use Node 20
nvm use 20

# Install PM2 globally
log "  → Installing PM2..."
npm install -g pm2

# Navigate to application
APP_DIR="$HOME/zerogex-web/frontend"
cd "$APP_DIR"

# Stop existing PM2 process if running
log "  → Stopping existing process (if any)..."
pm2 delete zerogex-web 2>/dev/null || true

# Start application with PM2
log "  → Starting application with PM2..."
pm2 start npm --name "zerogex-web" -- start

# Save PM2 process list
log "  → Saving PM2 configuration..."
pm2 save

# Setup PM2 to start on boot
log "  → Setting up PM2 startup script..."
PM2_STARTUP=$(pm2 startup | grep "sudo env PATH")
if [ ! -z "$PM2_STARTUP" ]; then
    eval $PM2_STARTUP
fi

# Show status
log "  → PM2 Status:"
pm2 status

log ""
log "PM2 setup complete!"
log ""
log "Summary:"
log "  ✓ PM2 installed"
log "  ✓ Application started and running"
log "  ✓ PM2 configured to start on boot"
log ""
log "Useful PM2 commands:"
log "  pm2 status             - Show all processes"
log "  pm2 logs zerogex-web   - View logs"
log "  pm2 restart zerogex-web - Restart application"
log "  pm2 stop zerogex-web    - Stop application"
log "  pm2 monit              - Monitor in real-time"
log ""
STEP040

chmod +x steps/040.pm2

# ==============================================
# FILE: deploy/steps/050.nginx
# ==============================================
cat > steps/050.nginx << 'STEP050'
#!/bin/bash

# ==============================================
# Step 050: Nginx Reverse Proxy Configuration
# ==============================================

set -e

log "Nginx Reverse Proxy Configuration"

# Prompt for domain name
read -p "  Enter your domain name (e.g., zerogex.io): " DOMAIN_NAME
while [ -z "$DOMAIN_NAME" ]; do
    echo "     ✗ Domain name cannot be empty"
    read -p "  Enter your domain name: " DOMAIN_NAME
done

# Create nginx configuration
log "  → Creating nginx configuration for $DOMAIN_NAME..."
sudo tee /etc/nginx/sites-available/zerogex-web > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN_NAME www.$DOMAIN_NAME;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable the site
log "  → Enabling site..."
sudo ln -sf /etc/nginx/sites-available/zerogex-web /etc/nginx/sites-enabled/

# Remove default nginx site
log "  → Removing default nginx site..."
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
log "  → Testing nginx configuration..."
if sudo nginx -t; then
    log "     ✓ Nginx configuration valid"
else
    log "     ✗ Nginx configuration invalid!"
    exit 1
fi

# Restart nginx
log "  → Restarting nginx..."
sudo systemctl restart nginx
sudo systemctl enable nginx

log ""
log "Nginx configuration complete!"
log ""
log "Summary:"
log "  ✓ Nginx configured for domain: $DOMAIN_NAME"
log "  ✓ Reverse proxy set up to port 3000"
log "  ✓ Nginx restarted and enabled"
log ""
log "Next steps:"
log "  1. Point your domain DNS to this server's IP"
log "  2. Run step 060.ssl to set up HTTPS with Let's Encrypt"
log ""
STEP050

chmod +x steps/050.nginx

# ==============================================
# FILE: deploy/steps/060.ssl
# ==============================================
cat > steps/060.ssl << 'STEP060'
#!/bin/bash

# ==============================================
# Step 060: SSL/HTTPS Setup with Let's Encrypt
# ==============================================

set -e

log "SSL/HTTPS Setup with Let's Encrypt"

# Get domain name from nginx config
DOMAIN_NAME=$(grep "server_name" /etc/nginx/sites-available/zerogex-web | awk '{print $2}' | sed 's/;//' | head -1)

if [ -z "$DOMAIN_NAME" ]; then
    log "  ✗ Could not determine domain name from nginx config"
    read -p "  Enter your domain name: " DOMAIN_NAME
fi

log "  → Domain: $DOMAIN_NAME"

# Prompt for email
read -p "  Enter email for Let's Encrypt notifications: " EMAIL
while [ -z "$EMAIL" ]; do
    echo "     ✗ Email cannot be empty"
    read -p "  Enter email: " EMAIL
done

# Install certbot
log "  → Installing certbot..."
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
log "  → Obtaining SSL certificate..."
log "     This will modify your nginx configuration automatically"

if sudo certbot --nginx -d "$DOMAIN_NAME" -d "www.$DOMAIN_NAME" --non-interactive --agree-tos -m "$EMAIL"; then
    log "     ✓ SSL certificate obtained successfully!"
else
    log "     ✗ Failed to obtain SSL certificate"
    log ""
    log "Common issues:"
    log "  • Domain DNS not pointing to this server yet"
    log "  • Port 80 not open in security group"
    log "  • Domain not resolving correctly"
    log ""
    log "You can retry this step later with:"
    log "  sudo certbot --nginx -d $DOMAIN_NAME -d www.$DOMAIN_NAME"
    exit 1
fi

# Test automatic renewal
log "  → Testing automatic renewal..."
sudo certbot renew --dry-run

log ""
log "SSL setup complete!"
log ""
log "Summary:"
log "  ✓ SSL certificate obtained for: $DOMAIN_NAME"
log "  ✓ Nginx configured for HTTPS"
log "  ✓ Automatic renewal configured"
log ""
log "Your site is now accessible at:"
log "  https://$DOMAIN_NAME"
log ""
STEP060

chmod +x steps/060.ssl

# ==============================================
# FILE: deploy/steps/070.security
# ==============================================
cat > steps/070.security << 'STEP070'
#!/bin/bash

# ==============================================
# Step 070: Security Hardening
# ==============================================

set -e

log "Security Hardening"

# Install UFW if not already installed
log "  → Installing UFW (Uncomplicated Firewall)..."
sudo apt install -y ufw

# Configure firewall rules
log "  → Configuring firewall rules..."

# Allow SSH (critical - do this first!)
log "     • Allowing SSH (port 22)..."
sudo ufw allow 22/tcp comment 'SSH access'

# Allow HTTP and HTTPS
log "     • Allowing HTTP (port 80)..."
sudo ufw allow 80/tcp comment 'HTTP'

log "     • Allowing HTTPS (port 443)..."
sudo ufw allow 443/tcp comment 'HTTPS'

# Set default policies
log "     • Setting default policies..."
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Enable firewall
log "  → Enabling firewall..."
echo "y" | sudo ufw enable

# Show firewall status
log "  → Firewall status:"
sudo ufw status verbose

# Configure fail2ban
log "  → Installing fail2ban..."
sudo apt install -y fail2ban

# Create fail2ban configuration
sudo tee /etc/fail2ban/jail.local > /dev/null << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = 22
logpath = %(sshd_log)s
backend = %(sshd_backend)s
EOF

# Start fail2ban
sudo systemctl enable fail2ban
sudo systemctl restart fail2ban

log ""
log "Security hardening complete!"
log ""
log "Summary:"
log "  ✓ UFW firewall configured"
log "  ✓ Ports open: 22 (SSH), 80 (HTTP), 443 (HTTPS)"
log "  ✓ fail2ban installed and configured"
log ""
STEP070

chmod +x steps/070.security

# ==============================================
# FILE: deploy/steps/100.validation
# ==============================================
cat > steps/100.validation << 'STEP100'
#!/bin/bash

# ==============================================
# Step 100: Deployment Validation
# ==============================================

set -e

log "Deployment Validation"

APP_DIR="$HOME/zerogex-web/frontend"

# Validation tracking
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Section 1: Node.js
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "1. Node.js Environment"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    log "  ✓ Node.js installed: $NODE_VERSION"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    log "  ✗ Node.js not found"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Section 2: Application
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "2. Application Files"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if [ -d "$APP_DIR" ]; then
    log "  ✓ Application directory exists"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    log "  ✗ Application directory not found"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if [ -d "$APP_DIR/.next" ]; then
    log "  ✓ Production build exists"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    log "  ✗ Production build not found"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Section 3: PM2
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "3. PM2 Process Manager"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if pm2 list | grep -q "zerogex-web"; then
    PM2_STATUS=$(pm2 list | grep zerogex-web | awk '{print $10}')
    if [ "$PM2_STATUS" = "online" ]; then
        log "  ✓ Application running (PM2)"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        log "  ✗ Application not running (status: $PM2_STATUS)"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
else
    log "  ✗ Application not found in PM2"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Section 4: Nginx
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "4. Nginx Configuration"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if sudo systemctl is-active --quiet nginx; then
    log "  ✓ Nginx is running"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    log "  ✗ Nginx is not running"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if [ -f /etc/nginx/sites-enabled/zerogex-web ]; then
    log "  ✓ Site configuration enabled"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    log "  ✗ Site configuration not found"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Section 5: Port Check
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "5. Port Connectivity"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    log "  ✓ Application responds on port 3000"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    log "  ✗ Application not responding on port 3000"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Final Summary
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "VALIDATION SUMMARY"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""
log "Total Checks: $TOTAL_CHECKS"
log "Passed: $PASSED_CHECKS"
log "Failed: $FAILED_CHECKS"
log ""

if [ "$FAILED_CHECKS" -eq 0 ]; then
    log "✓ Deployment validation PASSED!"
    log ""
    log "ZeroGEX Web is ready!"
    log ""
    log "Access your site:"
    DOMAIN=$(grep "server_name" /etc/nginx/sites-available/zerogex-web 2>/dev/null | awk '{print $2}' | sed 's/;//' | head -1)
    if [ ! -z "$DOMAIN" ]; then
        log "  https://$DOMAIN"
    fi
    log "  http://$(curl -s ifconfig.me):80"
else
    log "✗ Deployment validation FAILED!"
    log ""
    log "Please review failed checks above."
    exit 1
fi
STEP100

chmod +x steps/100.validation

log "Deployment structure created successfully!"
log ""
log "Files created:"
log "  deploy.sh"
log "  steps/010.setup"
log "  steps/020.nodejs"
log "  steps/030.application"
log "  steps/040.pm2"
log "  steps/050.nginx"
log "  steps/060.ssl"
log "  steps/070.security"
log "  steps/100.validation"

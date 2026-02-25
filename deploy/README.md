# ZeroGEX Web Deployment Guide

Complete deployment automation for the ZeroGEX Web Platform on a fresh Ubuntu server.

## Overview

This deployment system automates the complete setup of ZeroGEX Web including:
- System configuration and package installation
- Node.js 20+ installation via nvm
- Application cloning from git and dependency installation
- Production build
- PM2 process manager setup
- Nginx reverse proxy configuration
- SSL/HTTPS setup with Let's Encrypt
- Security hardening (UFW firewall, fail2ban)
- Deployment validation

## Prerequisites

- Ubuntu 20.04 or 22.04 LTS server (EC2 instance)
- Sudo access
- At least 2GB RAM (4GB+ recommended)
- 20GB+ storage
- Domain name pointing to server IP (for SSL)
- Git repository URL for zerogex-web
- AWS Security Group with ports open:
  - Port 22 (SSH)
  - Port 80 (HTTP)
  - Port 443 (HTTPS)

## Quick Start

```bash
# 1. SSH into your server
ssh ubuntu@your-server-ip

# 2. Clone the repository
git clone <your-zerogex-web-repo-url> zerogex-web
cd zerogex-web

# 3. Make deployment script executable
chmod +x deploy/deploy.sh
chmod +x deploy/steps/*

# 4. Run full deployment
./deploy/deploy.sh
```

## Deployment Steps

The deployment process runs these steps in order:

### Step 010: System Setup
- Updates system packages
- Installs essential tools (git, curl, nginx, build-essential, etc.)
- Configures timezone to America/New_York

### Step 020: Node.js Installation
- Installs nvm (Node Version Manager)
- Installs Node.js 20.x
- Sets Node 20 as default
- Verifies installation

### Step 030: Application Setup
- Clones/updates repository from git
- Navigates to frontend directory
- Installs npm dependencies
- Creates `.env.local` file from template
- Builds application for production (`npm run build`)

### Step 040: PM2 Process Manager
- Installs PM2 globally
- Starts application with PM2
- Configures PM2 to start on boot
- Saves PM2 process list

### Step 050: Nginx Reverse Proxy
- Prompts for domain name
- Creates nginx site configuration
- Sets up reverse proxy to port 3000
- Enables site and restarts nginx

### Step 060: SSL/HTTPS Setup
- Prompts for email address
- Installs certbot
- Obtains Let's Encrypt SSL certificate
- Configures automatic renewal
- Modifies nginx config for HTTPS

### Step 070: Security Hardening
- Configures UFW firewall (allows SSH, HTTP, HTTPS)
- Installs and configures fail2ban
- Sets default deny incoming policy

### Step 100: Deployment Validation
- Comprehensive deployment validation
- Checks Node.js installation
- Verifies application files and build
- Confirms PM2 process running
- Tests nginx configuration
- Validates port connectivity
- Reports summary with pass/fail

## Partial Deployment

You can start deployment from any step:

```bash
# Start from Node.js installation
./deploy/deploy.sh --start-from 020

# Start from application setup
./deploy/deploy.sh --start-from 030

# Start from nginx configuration
./deploy/deploy.sh --start-from 050

# Start from validation
./deploy/deploy.sh --start-from 100
```

## Post-Deployment Configuration

### 1. Verify Application is Running

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs zerogex-web

# Monitor in real-time
pm2 monit
```

### 2. Test Local Access

```bash
# Test application directly
curl http://localhost:3000

# Test through nginx
curl http://localhost
```

### 3. Configure DNS

Point your domain to the server's public IP:

```
A Record: zerogex.io -> your-server-ip
A Record: www.zerogex.io -> your-server-ip
```

Wait for DNS propagation (can take 5-60 minutes).

### 4. Verify HTTPS

Once DNS is propagated and SSL is set up:

```bash
# Test HTTPS
curl https://zerogex.io

# Check certificate
openssl s_client -connect zerogex.io:443 -servername zerogex.io
```

### 5. Environment Variables

Edit `.env.local` if needed:

```bash
cd ~/zerogex-web/frontend
nano .env.local
```

After editing, rebuild and restart:

```bash
npm run build
pm2 restart zerogex-web
```

## Application Management

### PM2 Commands

```bash
# View status
pm2 status

# View logs (live)
pm2 logs zerogex-web

# View logs (last 100 lines)
pm2 logs zerogex-web --lines 100

# Restart application
pm2 restart zerogex-web

# Stop application
pm2 stop zerogex-web

# Start application
pm2 start zerogex-web

# Delete from PM2
pm2 delete zerogex-web

# Monitor CPU/Memory
pm2 monit

# Save current process list
pm2 save

# Clear logs
pm2 flush
```

### Updating the Application

```bash
cd ~/zerogex-web
git pull
cd frontend
npm install
npm run build
pm2 restart zerogex-web
```

### Nginx Commands

```bash
# Test configuration
sudo nginx -t

# Reload nginx (without downtime)
sudo systemctl reload nginx

# Restart nginx
sudo systemctl restart nginx

# View nginx status
sudo systemctl status nginx

# View nginx error logs
sudo tail -f /var/log/nginx/error.log

# View nginx access logs
sudo tail -f /var/log/nginx/access.log
```

## Troubleshooting

### Application Won't Start

Check PM2 logs:
```bash
pm2 logs zerogex-web --err

# Or check for specific errors
pm2 logs zerogex-web | grep -i error
```

Common issues:
- Node.js not installed or wrong version
- Dependencies not installed (`npm install`)
- Build failed (`npm run build`)
- Port 3000 already in use

### Can't Access via Domain

1. **Check DNS propagation:**
```bash
nslookup zerogex.io
dig zerogex.io
```

2. **Check nginx is running:**
```bash
sudo systemctl status nginx
```

3. **Check nginx configuration:**
```bash
sudo nginx -t
cat /etc/nginx/sites-enabled/zerogex-web
```

4. **Check firewall:**
```bash
sudo ufw status
```

Ensure ports 80 and 443 are open.

5. **Check AWS Security Group:**
- Inbound rules must allow ports 80 (HTTP) and 443 (HTTPS)

### SSL Certificate Issues

**Certificate not obtained:**
```bash
# Check DNS is pointing to server
dig zerogex.io +short

# Should return your server's public IP
curl ifconfig.me
```

**Manually retry SSL:**
```bash
sudo certbot --nginx -d zerogex.io -d www.zerogex.io
```

**Check certificate expiration:**
```bash
sudo certbot certificates
```

**Test renewal:**
```bash
sudo certbot renew --dry-run
```

### Port 3000 Not Responding

```bash
# Check what's running on port 3000
sudo lsof -i :3000

# Or
sudo netstat -tlnp | grep 3000

# Check PM2 status
pm2 status

# Restart if needed
pm2 restart zerogex-web
```

### Build Failures

If `npm run build` fails due to memory:

```bash
# Add swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify
free -h

# Retry build
cd ~/zerogex-web/frontend
npm run build
```

### Nginx 502 Bad Gateway

This means nginx can't reach the application:

```bash
# Check PM2 is running
pm2 status

# Check application is responding
curl http://localhost:3000

# If not responding, restart
pm2 restart zerogex-web
```

## Security

### Firewall Status

```bash
# View firewall rules
sudo ufw status verbose

# View numbered rules
sudo ufw status numbered
```

### fail2ban Status

```bash
# Check fail2ban status
sudo systemctl status fail2ban

# View banned IPs
sudo fail2ban-client status sshd

# Unban an IP
sudo fail2ban-client set sshd unbanip <ip-address>
```

### Security Best Practices

1. **Keep system updated:**
```bash
sudo apt update && sudo apt upgrade -y
```

2. **Monitor logs regularly:**
```bash
# System logs
sudo journalctl -f

# Application logs
pm2 logs zerogex-web

# Nginx logs
sudo tail -f /var/log/nginx/error.log
```

3. **Use SSH keys only** (password auth should be disabled)

4. **Keep SSL certificates renewed** (certbot handles this automatically)

## Directory Structure

```
/home/ubuntu/
└── zerogex-web/
    ├── frontend/                # Next.js application
    │   ├── .next/              # Production build
    │   ├── node_modules/       # Dependencies
    │   ├── .env.local          # Environment config
    │   └── package.json
    ├── deploy/                  # Deployment scripts
    │   ├── deploy.sh
    │   ├── README.md
    │   └── steps/
    └── README.md

/etc/nginx/
└── sites-available/
    └── zerogex-web             # Nginx site config

/var/log/nginx/
├── access.log                  # HTTP access logs
└── error.log                   # Nginx error logs

/etc/letsencrypt/
└── live/
    └── zerogex.io/             # SSL certificates
```

## Performance Optimization

### PM2 Cluster Mode

For better performance, run in cluster mode:

```bash
# Stop current instance
pm2 delete zerogex-web

# Start in cluster mode (uses all CPU cores)
cd ~/zerogex-web/frontend
pm2 start npm --name "zerogex-web" -i max -- start

# Save
pm2 save
```

### Nginx Caching

Add to nginx configuration for static assets:

```nginx
location /_next/static/ {
    alias /home/ubuntu/zerogex-web/frontend/.next/static/;
    expires 1y;
    access_log off;
    add_header Cache-Control "public, immutable";
}
```

### Enable Gzip Compression

Add to nginx config:

```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
```

## Monitoring

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Memory and CPU usage
pm2 list

# Application metrics
pm2 describe zerogex-web
```

### System Resources

```bash
# CPU and memory
htop

# Disk usage
df -h

# Disk I/O
iostat

# Network connections
netstat -tunlp
```

## Backup Strategy

### Application Backup

```bash
# Backup application code
cd ~
tar -czf zerogex-web-backup-$(date +%Y%m%d).tar.gz zerogex-web/

# Copy to S3 (optional)
aws s3 cp zerogex-web-backup-$(date +%Y%m%d).tar.gz s3://your-bucket/backups/
```

### Automated Backups

Create a cron job:

```bash
crontab -e
```

Add:
```
0 2 * * * cd ~ && tar -czf zerogex-web-backup-$(date +\%Y\%m\%d).tar.gz zerogex-web/ && find ~/ -name "zerogex-web-backup-*.tar.gz" -mtime +7 -delete
```

This backs up daily at 2 AM and keeps 7 days of backups.

## Logs

### Application Logs

```bash
# Live logs
pm2 logs zerogex-web

# Last 100 lines
pm2 logs zerogex-web --lines 100

# Error logs only
pm2 logs zerogex-web --err

# Clear logs
pm2 flush
```

### Nginx Logs

```bash
# Access logs (live)
sudo tail -f /var/log/nginx/access.log

# Error logs (live)
sudo tail -f /var/log/nginx/error.log

# Filter for specific domain
sudo grep "zerogex.io" /var/log/nginx/access.log
```

### System Logs

```bash
# View all logs
sudo journalctl -f

# Nginx service logs
sudo journalctl -u nginx -f

# Last 100 lines
sudo journalctl -n 100
```

## Support

For deployment issues:
1. Check deployment logs: `~/logs/web_deployment_*.log`
2. Review service logs: `pm2 logs zerogex-web`
3. Verify nginx logs: `/var/log/nginx/error.log`
4. Run validation: `./deploy/deploy.sh --start-from 100`
5. Check security group and firewall settings

## License

© 2026 ZeroGEX, LLC. All rights reserved.

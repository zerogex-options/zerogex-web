# ZeroGEX Web Platform

Professional-grade options flow analytics platform providing real-time gamma exposure (GEX) analysis, dealer positioning insights, and options flow tracking.

## 🏗️ Architecture

```
zerogex-web/
├── frontend/              # Next.js 14 TypeScript application
│   ├── app/              # Pages and routing
│   ├── components/       # Reusable React components
│   └── lib/             # Utilities, types, constants
├── backend/              # FastAPI Python server (coming soon)
├── grafana/             # Grafana dashboards (coming soon)
├── deploy/              # Deployment automation scripts
│   ├── deploy.sh        # Main deployment script
│   ├── steps/           # Individual deployment steps
│   └── README.md        # Deployment guide
└── docker-compose.yml   # Full stack orchestration (coming soon)
```

## 🎨 Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Recharts** - Chart visualizations
- **Lucide React** - Icon library

### Backend (Upcoming)
- **FastAPI** - Python REST API + WebSocket
- **PostgreSQL** - Read replica for analytics
- **Redis** - Caching layer
- **Grafana** - Advanced dashboards

### Deployment
- **PM2** - Process manager for Node.js
- **Nginx** - Reverse proxy and web server
- **Let's Encrypt** - Free SSL certificates
- **UFW + fail2ban** - Security hardening

## 📋 Prerequisites

### For Development
- **Node.js** >= 20.9.0
- **npm** or **yarn**
- **Git**

### For Production Deployment
- Ubuntu 20.04 or 22.04 LTS server (EC2 instance)
- Sudo access
- At least 2GB RAM (4GB+ recommended)
- 20GB+ storage
- Domain name (for SSL)
- AWS Security Group with ports 22, 80, 443 open

## 🚀 Quick Start (Development)

### Local Development

```bash
# 1. Clone the repository
git clone <your-repo-url> zerogex-web
cd zerogex-web/frontend

# 2. Install dependencies
sudo apt update
sudo apt install npm
npm install

# 3. Run development server
npm run dev
```

Visit `http://localhost:3000`

### Production Build (Local)

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 🌐 Production Deployment (Automated)

We provide automated deployment scripts for Ubuntu servers. See **[deploy/README.md](deploy/README.md)** for detailed instructions.

### Quick Deployment

```bash
# 1. SSH into your server
ssh ubuntu@your-server-ip

# 2. Clone repository
git clone <your-repo-url> zerogex-web
cd zerogex-web

# 3. Make scripts executable
chmod +x deploy/deploy.sh
chmod +x deploy/steps/*

# 4. Run deployment
./deploy/deploy.sh
```

This will automatically:
- ✅ Install Node.js 20 via nvm
- ✅ Install dependencies and build application
- ✅ Set up PM2 process manager
- ✅ Configure Nginx reverse proxy
- ✅ Obtain SSL certificate (Let's Encrypt)
- ✅ Configure firewall and security
- ✅ Validate deployment

**See [deploy/README.md](deploy/README.md) for complete deployment documentation.**

## 🖥️ Manual Deployment on EC2

If you prefer manual deployment or need more control:

### 1. Install Node.js 20+

```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20
```

### 2. Clone and Build

```bash
cd ~
git clone <your-repo-url> zerogex-web
cd zerogex-web/frontend
npm install
npm run build
```

### 3. Install PM2

```bash
npm install -g pm2
pm2 start npm --name "zerogex-web" -- start
pm2 save
pm2 startup
```

### 4. Configure Nginx

```bash
sudo apt install nginx

# Create site configuration
sudo nano /etc/nginx/sites-available/zerogex-web
```

**Nginx config:**
```nginx
server {
    listen 80;
    server_name zerogex.io www.zerogex.io;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/zerogex-web /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. Set Up SSL

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d zerogex.io -d www.zerogex.io
```

## 🎨 Color Scheme

The platform uses a professional color palette:

```typescript
{
  dark: '#423d3f',      // Primary dark background
  muted: '#968f92',     // Secondary text, borders
  light: '#f2f2f2',     // Light background, primary text
  bearish: '#f45854',   // Red for negative/bearish
  bullish: '#10b981',   // Green for positive/bullish
  bgDark: '#2a2628',    // Dark mode background
  cardDark: '#423d3f',  // Dark mode cards
  bgLight: '#f2f2f2',   // Light mode background
  cardLight: '#ffffff', // Light mode cards
}
```

## 📱 Features

### Current (Frontend Only)
- ✅ Real-time market session indicator
- ✅ World clocks (NY, London, Tokyo)
- ✅ Light/dark mode toggle
- ✅ Responsive mobile design
- ✅ Critical metrics dashboard
- ✅ Mock data visualizations:
  - Gamma Exposure by Strike
  - Live Options Flow
  - Dealer Hedging Pressure
  - Smart Money Flow tracker

### Coming Soon (Backend Integration)
- 🔄 Live WebSocket data updates (1 second refresh)
- 🔄 PostgreSQL read replica integration
- 🔄 FastAPI REST endpoints
- 🔄 Grafana embedded dashboards
- 🔄 Historical data analysis
- 🔄 Multi-symbol support (SPY, SPX, QQQ, IWM)

## 🛠️ Development

### Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout with theme provider
│   ├── page.tsx           # Dashboard (home)
│   ├── flow-analysis/     # Options flow page
│   ├── greeks-gex/        # Greeks analysis page
│   ├── intraday-tools/    # Intraday trading tools
│   └── about/             # About page
├── components/            # Reusable components
│   ├── Header.tsx         # App header with live price
│   ├── Navigation.tsx     # Main navigation
│   ├── MetricCard.tsx     # Dashboard metric cards
│   └── ...
└── lib/                   # Utilities
    ├── colors.ts          # Color constants
    ├── types.ts           # TypeScript types
    └── utils.ts           # Helper functions
```

### Environment Variables

Create `.env.local`:

```bash
# API Configuration (when backend is ready)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws

# Feature Flags
NEXT_PUBLIC_ENABLE_WEBSOCKET=false
NEXT_PUBLIC_ENABLE_GRAFANA=false
```

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```

## 🔧 Application Management

### PM2 Commands

```bash
# View status
pm2 status

# View logs
pm2 logs zerogex-web

# Restart application
pm2 restart zerogex-web

# Stop application
pm2 stop zerogex-web

# Monitor resources
pm2 monit
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

## 🐛 Troubleshooting

### Build Fails with Memory Error

**Solution:** Add swap space

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Port 3000 Already in Use

**Solution:** Kill the process

```bash
sudo lsof -i :3000
pkill -f next
```

Or use a different port:
```bash
PORT=3001 npm start
```

### Can't Access from Browser

**Solutions:**
1. Check AWS Security Group has ports 80/443 open
2. Verify nginx is running: `sudo systemctl status nginx`
3. Check PM2 status: `pm2 status`
4. Test locally: `curl http://localhost:3000`

### 502 Bad Gateway (Nginx)

**Solution:** Application not responding

```bash
# Check PM2
pm2 status

# Restart if needed
pm2 restart zerogex-web

# Check logs
pm2 logs zerogex-web
```

### SSL Certificate Issues

**Solution:** Verify DNS and retry

```bash
# Check DNS
dig zerogex.io +short

# Should match your server IP
curl ifconfig.me

# Retry certificate
sudo certbot --nginx -d zerogex.io -d www.zerogex.io
```

## 📊 Performance

### Production Optimizations

- Static page generation where possible
- Code splitting and lazy loading
- Gzip compression via nginx
- PM2 cluster mode for multi-core utilization

### Enable PM2 Cluster Mode

```bash
pm2 delete zerogex-web
cd ~/zerogex-web/frontend
pm2 start npm --name "zerogex-web" -i max -- start
pm2 save
```

## 🔒 Security

### Firewall (UFW)

```bash
# View status
sudo ufw status verbose

# Rules configured by deployment:
# - Port 22 (SSH)
# - Port 80 (HTTP)
# - Port 443 (HTTPS)
```

### fail2ban

```bash
# Check status
sudo systemctl status fail2ban

# View banned IPs
sudo fail2ban-client status sshd
```

### Best Practices

- ✅ Use SSH keys only (password auth disabled)
- ✅ Keep system updated: `sudo apt update && sudo apt upgrade`
- ✅ Monitor logs regularly
- ✅ SSL certificates auto-renew via certbot

## 📈 Monitoring

### PM2 Monitoring

```bash
pm2 monit              # Real-time monitoring
pm2 logs zerogex-web   # Application logs
pm2 list               # Process list
```

### System Monitoring

```bash
htop                   # CPU/Memory
df -h                  # Disk usage
sudo ufw status        # Firewall
sudo systemctl status nginx  # Web server
```

### Logs

```bash
# Application logs
pm2 logs zerogex-web

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# System logs
sudo journalctl -f
```

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and test locally
3. Build: `npm run build`
4. Commit: `git commit -m "Add feature"`
5. Push: `git push origin feature/your-feature`
6. Create Pull Request

## 📄 License

© 2026 ZeroGEX, LLC. All rights reserved.

## 🔗 Links

- **Production:** https://zerogex.io
- **Deployment Guide:** [deploy/README.md](deploy/README.md)
- **Database Schema:** [setup/database/schema.sql](../zerogex-oa/setup/database/schema.sql)

## 📞 Support

For deployment issues:
1. Check deployment logs: `~/logs/web_deployment_*.log`
2. Review [deploy/README.md](deploy/README.md)
3. Run validation: `./deploy/deploy.sh --start-from 100`
4. Check PM2 logs: `pm2 logs zerogex-web`
5. Verify nginx: `sudo nginx -t`

## 🗺️ Roadmap

**Phase 1: Frontend ✅ (Complete)**
- ✅ Core UI/UX
- ✅ Mock data visualization
- ✅ Responsive design
- ✅ Production deployment

**Phase 2: Backend (In Progress)**
- 🔄 FastAPI server
- 🔄 PostgreSQL read replica
- 🔄 WebSocket integration
- 🔄 Real-time data pipeline

**Phase 3: Analytics (Planned)**
- 📅 Grafana dashboards
- 📅 Historical analysis
- 📅 Advanced charting
- 📅 Custom alerts

**Phase 4: Production (Planned)**
- 📅 Multi-symbol support
- 📅 User authentication
- 📅 Premium features
- 📅 Mobile app

---

**Built with ❤️ for professional traders**

# ZeroGEX Web Deployment Guide

Complete deployment automation for the ZeroGEX Web Platform on a fresh Ubuntu server.

## Overview

This deployment system automates the complete setup of ZeroGEX Web including:
- System configuration and package installation
- Node.js 22+ installation via nvm
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

## Zero-touch fresh deploy

For a fully unattended end-to-end install on a brand-new box, set every
operator input as an env var so no step prompts:

### Preconditions (must be true *before* you run the script)

1. **DNS** — `<domain>` and `www.<domain>` A/AAAA records already point at
   the server's public IP. Step 070 (Let's Encrypt) fails fast if DNS
   isn't ready.
2. **Inbound ports** — the AWS security group / firewall allows 22 / 80 /
   443.
3. **`frontend/.env.local`** — created from `frontend/.env.example` with
   the secrets you have *now* filled in. Every secret you skip will end up
   as an empty placeholder after deploy and surface as a runtime error the
   first time someone exercises that feature (e.g. an empty
   `STRIPE_PRICE_BASIC` returns `Stripe price not configured for tier:
   basic` from `/api/billing/checkout`). Specifically, populate at least:
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
     `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PRO`, `NEXT_PUBLIC_APP_URL`
     (from your Stripe dashboard; webhook endpoint is
     `https://<domain>/api/webhooks/stripe`).
   - `GOOGLE_CLIENT_*`, `APPLE_CLIENT_*`, `ADMIN_BOOTSTRAP_*` if you
     intend to enable auth (`ENABLE_AUTH=1`).
4. **OAuth consoles** — if `ENABLE_AUTH=1`, the Google and Apple OAuth
   apps already have `https://<domain>/api/auth/oauth/{google,apple}/callback`
   registered as authorized redirect URIs.

### One-liner

```bash
git clone <repo-url> zerogex-web && cd zerogex-web
cp frontend/.env.example frontend/.env.local
# ... fill in frontend/.env.local with secrets ...
chmod +x deploy/deploy.sh deploy/steps/*

WEB_DOMAIN=zerogex.io \
LETSENCRYPT_EMAIL=admin@zerogex.io \
ENABLE_AUTH=1 \
./deploy/deploy.sh
```

| Env var              | Step(s) it silences | Required for unattended? |
| -------------------- | ------------------- | ------------------------ |
| `WEB_DOMAIN`         | 030, 050, 070       | yes                      |
| `LETSENCRYPT_EMAIL`  | 070                 | yes                      |
| `ENABLE_AUTH=1`      | 035                 | only if enabling auth    |

If any of these are unset, the corresponding step falls back to an
interactive `read -p` prompt — convenient for hands-on installs, fatal
for unattended ones.

## Deployment Steps

The deployment process runs these steps in order:

### Step 010: System Setup
- Updates system packages
- Installs essential tools (git, curl, nginx, build-essential, etc.)
- Configures timezone to America/New_York

### Step 020: Node.js Installation
- Installs nvm (Node Version Manager)
- Installs Node.js 22.x
- Sets Node 22 as default
- Verifies installation

### Step 030: Application Setup
- Clones/updates repository from git
- Navigates to frontend directory
- Installs npm dependencies
- Idempotently merges required keys into `.env.local` (never overwrites existing values)
- Seeds `NEXT_PUBLIC_AUTH_ENABLED=0` so auth ships dormant
- Builds application for production (`npm run build`)

### Step 035: Authentication Setup (idempotent)
- Creates `/var/lib/zerogex/` with mode 700 for the SQLite auth DB
- Merges missing auth env keys (`AUTH_DB_PATH`, `ADMIN_BOOTSTRAP_*`, `GOOGLE_*`, `APPLE_*`) into `.env.local` as empty placeholders
- Runs `npm run test:auth`
- Re-run with `ENABLE_AUTH=1` to flip the flag, set callback URLs for a domain, and rebuild:
  ```bash
  ENABLE_AUTH=1 ./deploy/deploy.sh --start-from 035
  ```
  You still need to fill in `GOOGLE_CLIENT_*`, `APPLE_CLIENT_*`, and `ADMIN_BOOTSTRAP_*` by hand before the first `pm2 restart`.

### Step 036: Billing / Stripe Setup (idempotent)
- Idempotently merges Stripe + public-app-URL keys into `.env.local` as empty placeholders (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PRO`, `NEXT_PUBLIC_APP_URL`)
- Defaults `NEXT_PUBLIC_APP_URL` to `https://${WEB_DOMAIN}` when `WEB_DOMAIN` is set; leaves it blank otherwise
- Prints the Stripe webhook URL operators must register: `https://<domain>/api/webhooks/stripe`
- Reminder: `NEXT_PUBLIC_APP_URL` is inlined at build time — fill it in *before* the first `npm run build`, or `make rebuild` after editing

### Step 040: PM2 Process Manager
- Installs PM2 globally **under the active nvm Node (currently v22)**
- Starts the application via the checked-in `ecosystem.config.js`
- Configures PM2 to start on boot
- Saves PM2 process list

> **Bumping the Node major version later (e.g. 22 → 24)**
>
> PM2 is installed inside `~/.nvm/versions/node/<version>/bin/`, and `pm2 startup`
> bakes that exact path into the systemd unit it generates. If you switch the
> default nvm Node version after deployment, the boot-time pm2 will still run
> against the old Node — including any global pm2 you reinstall under the new
> version. To migrate:
>
> ```bash
> source $HOME/.nvm/nvm.sh
> nvm use <new-version>
> npm install -g pm2
> pm2 update                           # respawn daemon under new Node
> sudo env PATH=$PATH:$(dirname $(which node)) \
>     $(which pm2) unstartup systemd -u ubuntu --hp /home/ubuntu
> pm2 startup                          # generate a new unit, then run the printed sudo command
> pm2 save
> ```

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

### Step 080: Auth DB Backup Timer (idempotent)
- Ensures `sqlite3` is installed (required for the online `.backup`)
- Pre-creates the `~/zerogex-auth-backups` output dir (mode 700) so the
  hardened service's `ReadWritePaths` resolves
- Installs and enables `zerogex-web-auth-backup.{service,timer}` (hourly,
  `Persistent=true`) from `deploy/systemd/`
- Seeds `deploy/systemd/backup-auth.env` (mode 600) from the example on
  first run — backups are local-only until you set `S3_BUCKET` /
  `BACKUP_GPG_RECIPIENT` there
- Runs one verification backup if the auth DB already exists
- See "Auth Database Backups" below for restore + the S3/encryption knobs

### Step 081: Admin->Monitoring Data Backup Timer (idempotent)
- Pre-creates the `~/zerogex-monitoring-backups` output dir (mode 700) so the
  hardened service's `ReadWritePaths` resolves
- Installs and enables `zerogex-web-monitoring-backup.{service,timer}` (every
  6h, `Persistent=true`) from `deploy/systemd/`, running `make backup-monitoring`
- Seeds `deploy/systemd/monitoring-backup.env` (mode 600) from the example on
  first run — backups are local-only until you set `S3_BUCKET` there
- Runs one verification backup if the JSON stores already exist
- Backs up `signups.json` + `mrr.json` (the append-only daily subscriber/MRR
  history — their only off-box copy) plus `monitoring.json`; see "Monitoring
  Data Backup" below for restore

### Step 094: Nightly Janitor Timer (idempotent)
- Pre-creates the janitor's `ReadWritePaths` (`~/zerogex-auth-backups` mode 700,
  `~/.npm` mode 755) so the hardened service's mount namespace resolves
- Installs and enables `zerogex-web-janitor.{service,timer}` (nightly 04:50,
  `Persistent=true`) from `deploy/systemd/`, running `make janitor-noconfirm`
- Seeds `deploy/systemd/janitor.env` (mode 600) from the example on first run —
  Makefile defaults apply (retention 30d, keep-newest 48) until you tune it there
- Runs one verification cleanup (the janitor is idempotent and safe to run any
  time)
- Prunes old auth backups with a keep-newest-K floor (the same shared pruner
  `make backup-auth` runs hourly), clears `frontend/.next/cache`, and cleans the
  npm cache; see "Nightly Janitor" below

### Step 100: Deployment Validation
- Comprehensive deployment validation
- Checks Node.js installation
- Verifies application files and build
- Confirms PM2 process running
- Tests nginx configuration
- Validates port connectivity
- Confirms the auth-DB backup timer is enabled
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

### Monitoring Data Backup

The Admin -> Monitoring charts read three JSON files that live only on the
server. They are gitignored, so they are **not** in the application code
backup unless you tar the whole directory:

- `frontend/data/monitoring.json` - API calls, page accesses, unique users/IPs
- `frontend/data/signups.json` - daily Basic/Pro/paying subscriber totals
- `frontend/data/mrr.json` - daily MRR + active/trialing subscriber history

`signups.json` and `mrr.json` are **append-only, never pruned, and the only
copy** of the daily subscriber/MRR history — losing the instance volume loses
it, so keeping them backed up off-box is what makes those daily numbers durable.

Deploy step 081 installs a systemd timer that runs the backup automatically
every 6h (see "Step 081" above); it is local-only until you set `S3_BUCKET` in
`deploy/systemd/monitoring-backup.env`. You can also run it on demand with the
bundled make target. The app writes these files atomically (temp file +
rename), so it is safe to run against the live process without stopping PM2:

```bash
cd ~/zerogex-web
make backup-monitoring                                       # local only
make backup-monitoring S3_BUCKET=s3://your-bucket/zerogex     # also upload to S3
```

Options (all optional):

- `BACKUP_DIR` - where archives are written (default `~/zerogex-monitoring-backups`, outside the repo so it is not swept into the whole-app backup)
- `BACKUP_RETENTION_DAYS` - prune local archives older than N days (default 30)
- `S3_BUCKET` - if set, also `aws s3 cp` the archive there

To back up on a different schedule, edit the timer's `OnCalendar` in
`deploy/systemd/zerogex-web-monitoring-backup.timer`. (A `crontab -e` line
calling `make backup-monitoring` works too if you prefer cron over the timer.)

Restore by extracting an archive back into place:

```bash
tar -xzf ~/zerogex-monitoring-backups/monitoring-data-YYYYMMDD-HHMMSS.tar.gz -C ~/zerogex-web/frontend/data/
make restart
```

### Auth Database Backups

The SQLite auth DB (`AUTH_DB_PATH`, default `/var/lib/zerogex/auth.db`) is
the **only** copy of every user account, session, OAuth identity link,
password-reset token, and the user→tier mapping that reconciles against
Stripe. It lives on the instance volume and nothing else replicates it, so
losing the volume loses every account. Back it up.

`make backup-auth` takes an **online** snapshot via SQLite's `.backup`
command — safe to run against the live PM2 process in WAL mode, unlike a
plain `cp` which can capture a torn WAL and produce a corrupt copy. The
snapshot is integrity-checked (`PRAGMA integrity_check`) before it is kept,
then gzip'd into `~/zerogex-auth-backups` (outside the repo). Requires the
`sqlite3` CLI (`sudo apt-get install -y sqlite3`).

```bash
cd ~/zerogex-web
make backup-auth                                                 # local only
make backup-auth S3_BUCKET=s3://your-bucket/zerogex/auth          # also upload to S3
make backup-auth BACKUP_GPG_RECIPIENT=ops@zerogex.com S3_BUCKET=s3://your-bucket/zerogex/auth  # encrypt at rest
```

Options (all optional):

- `AUTH_DB_PATH` — source DB; defaults to the value in `frontend/.env.local`, then `frontend/data/auth.db`.
- `AUTH_BACKUP_DIR` — where archives are written (default `~/zerogex-auth-backups`).
- `AUTH_BACKUP_RETENTION_DAYS` — prune local archives older than N days (default 30).
- `AUTH_BACKUP_KEEP` — keep-newest floor: the prune ALWAYS keeps the newest K archives regardless of age (default 48 = 2 days of hourly backups), so a stalled backup can never leave you with zero copies. `AUTH_BACKUP_KEEP=0` restores raw mtime-only behavior. The prune is a shared target (`make auth-backups-prune`) that both `backup-auth` (hourly) and the nightly janitor run — see "Nightly Janitor" below.
- `S3_BUCKET` — if set, also `aws s3 cp` the archive there.
- `BACKUP_GPG_RECIPIENT` — encrypt the archive with GPG before it leaves the box. **Strongly recommended:** the archive contains password hashes and PII. If this is unset, the destination S3 bucket MUST be private with server-side encryption (see `zerogex-oa/deploy/BACKUP_RESILIENCE.md`).

Because the DB is small and holds account data that changes all day
(signups, sessions, password resets, tier changes), back it up **hourly**
with long retention — not nightly.

#### Scheduling (systemd timer — recommended)

A timer is preferred over cron here because `Persistent=true` re-runs a
missed backup as soon as the box comes back up (cron silently skips it),
and you get journald logging plus `systemctl list-timers` visibility. The
units live in `deploy/systemd/`:

```bash
# Optional config (S3 bucket, GPG recipient, paths). Without it, the job
# takes a local-only, unencrypted backup. The file lives in your own repo
# dir, so edit it directly — no sudo (sudoedit refuses a user-writable dir).
cp deploy/systemd/backup-auth.env.example deploy/systemd/backup-auth.env
chmod 600 deploy/systemd/backup-auth.env
$EDITOR deploy/systemd/backup-auth.env         # set S3_BUCKET, BACKUP_GPG_RECIPIENT

sudo cp deploy/systemd/zerogex-web-auth-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now zerogex-web-auth-backup.timer

systemctl list-timers zerogex-web-auth-backup.timer   # confirm next run
sudo systemctl start zerogex-web-auth-backup.service   # run once now to verify
journalctl -u zerogex-web-auth-backup -n 20            # check it succeeded
```

The service runs as `ubuntu` with `ProtectSystem=strict`; its
`ReadWritePaths` are `/var/lib/zerogex` (SQLite's online backup maps the
live `-shm`, so the source dir must be writable) and the backup output
dir. If you change `AUTH_DB_PATH` or `AUTH_BACKUP_DIR`, update
`ReadWritePaths` in the service to match.

#### Scheduling (cron alternative)

If you'd rather keep the web box purely on cron (matching the
`backup-monitoring` and whole-app backup jobs), add to `crontab -e`
(offset from the 02:00/02:30 jobs):

```
15 * * * * cd ~/zerogex-web && make backup-auth S3_BUCKET=s3://your-bucket/zerogex/auth >> ~/zerogex-auth-backup.log 2>&1
```

Restore (the snapshot is a complete, standalone database):

```bash
make stop                                                        # stop the single writer
gunzip -c ~/zerogex-auth-backups/auth-YYYYMMDD-HHMMSS.db.gz > "$AUTH_DB_PATH"   # add .gpg + gpg -d if encrypted
sqlite3 "$AUTH_DB_PATH" 'PRAGMA integrity_check;'                # expect: ok
make start
```

> AWS-side hardening for these backups (S3 versioning + Object Lock,
> cross-region copy, EBS snapshots, RDS retention/PITR/Multi-AZ) is
> tracked as a checklist in `zerogex-oa/deploy/BACKUP_RESILIENCE.md`.

### Nightly Janitor

A single nightly timer (`zerogex-web-janitor.timer`, 04:50) runs
`make janitor-noconfirm` as `ubuntu` to keep zerogex-web's own
retention/regenerable data in check. Installed by deploy step 094. It does three
things, all safe/regenerable:

1. **Auth-backup retention (keep-newest-K floor).** Prunes
   `~/zerogex-auth-backups/auth-*.db.gz*` older than `AUTH_BACKUP_RETENTION_DAYS`
   (default 30) but ALWAYS keeps the newest `AUTH_BACKUP_KEEP` (default 48)
   regardless of age. The auth DB is Tier-1 (RPO ~1h), so the floor is a safety
   net: a bare `find -mtime +N -delete` would, if backups ever stall (bad creds,
   full disk), keep deleting until zero backups remain — the floor guarantees the
   newest K survive even then. This is the **same** shared target
   (`make auth-backups-prune`) that `make backup-auth` runs after each hourly
   snapshot, so there is exactly one pruner, floored, on two cadences.
   `AUTH_BACKUP_KEEP=0` is the escape hatch for raw mtime-only behavior.
2. **Next.js build cache.** `rm -rf frontend/.next/cache` — only the cache subdir
   (documented-safe to delete), never the built `.next` output.
3. **npm cache.** `npm cache clean --force`, run as the app user (never root).

Every external tool is guarded (`command -v`) and per-item errors are swallowed,
so a missing tool/path can never fail the run. Tune it per box in
`deploy/systemd/janitor.env` (retention, keep floor, cache path); nothing there
is secret. It is scheduled at the tail of the maintenance window (after the
02:00/02:30 crons and 03:30 partner-grant sweep, 10 min before the 05:00 hourly
auth backup).

```bash
make janitor                                   # interactive: prints the plan, asks before acting
make janitor-noconfirm                         # what the timer runs (no prompt)
make janitor-noconfirm AUTH_BACKUP_KEEP=72 AUTH_BACKUP_RETENTION_DAYS=14   # override the floor / retention
systemctl list-timers zerogex-web-janitor.timer   # next/last run
journalctl -u zerogex-web-janitor -n 30           # recent janitor logs
```

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

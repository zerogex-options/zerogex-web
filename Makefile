.PHONY: help install dev build rebuild start stop restart logs status users migrate-tiers all-to-pro delete-user seed-founders clear-zombie-customers webhook-health backup-monitoring clean deploy logo

# Default target
help:
	@echo "ZeroGEX Web - Available Commands:"
	@echo ""
	@echo "  make install    - Install dependencies"
	@echo "  make dev        - Run development server"
	@echo "  make build      - Build for production"
	@echo "  make rebuild    - Clean build and restart PM2"
	@echo "  make start      - Start PM2 process"
	@echo "  make stop       - Stop PM2 process"
	@echo "  make restart    - Restart PM2 process"
	@echo "  make logs       - View PM2 logs (live)"
	@echo "  make status     - Check PM2 status"
	@echo "  make users      - Print auth users + entitlements (TIER=Admin|Pro|Basic, AUTH=L|G|A, EMAIL_ONLY=yes)"
	@echo "                    Founder column: E=eligible, R=redeemed (intro 12mo), L=lifetime 25% off"
	@echo "  make migrate-tiers - Migrate legacy starter/elite users to basic/pro (DRY_RUN=1 to preview)"
	@echo "  make all-to-pro - Promote every non-admin user to pro (DRY_RUN=1 to preview)"
	@echo "  make delete-user EMAIL=<email> - Delete a user (DRY_RUN=1 to preview, YES=1 to skip prompt)"
	@echo "  make seed-founders - Flag current users as founding_eligible (DRY_RUN=1 to preview, YES=1 to apply, BEFORE=<iso> for cutoff)"
	@echo "  make clear-zombie-customers - NULL stripe_customer_id on rows with no subscription (APPLY=1 to write, dry-run by default)"
	@echo "  make webhook-health - Stripe webhook health summary (errors/orphans/failed payments, last 24h + 7d)"
	@echo "  make backup-monitoring - Backup Admin->Monitoring JSON data (S3_BUCKET=s3://... optional)"
	@echo "  make clean      - Remove build artifacts"
	@echo "  make deploy     - Full deployment (pull, install, rebuild)"
	@echo "  make logo       - Copy logos from assets to public"
	@echo ""

# Install dependencies
install:
	@echo "Installing dependencies..."
	cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && npm install'

# Run development server
dev:
	@echo "Starting development server..."
	cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && npm run dev'

# Build for production
build:
	@echo "Building for production..."
	cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && npm run build'

# Clean build and restart
rebuild:
	@echo "Cleaning build directory..."
	rm -rf frontend/.next
	@echo "Building for production..."
	cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && npm run build'
	@echo "Restarting PM2 process..."
	bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && pm2 restart zerogex-web'
	@echo "Rebuild complete!"

# Start PM2 process
start:
	@echo "Starting PM2 process..."
	bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && pm2 start ecosystem.config.js'

# Stop PM2 process
stop:
	@echo "Stopping PM2 process..."
	bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && pm2 stop zerogex-web'

# Restart PM2 process
restart:
	@echo "Restarting PM2 process..."
	bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && pm2 restart zerogex-web'

# View logs
logs:
	@echo "Viewing PM2 logs (Ctrl+C to exit)..."
	bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && pm2 logs zerogex-web'

# Check PM2 status
status:
	@echo "PM2 process status:"
	bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && pm2 status zerogex-web'
	@echo ""
	@echo "Detailed info:"
	bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && pm2 describe zerogex-web'

# Print auth users and entitlements from SQLite. Optional filters:
#   TIER=Admin|Pro|Basic    Filter to one tier
#   AUTH=L|G|A              Filter to users with that auth method (L=local, G=Google, A=Apple)
#   EMAIL_ONLY=yes          Print only email addresses, one per line
users:
	@cd frontend && TIER='$(TIER)' AUTH='$(AUTH)' EMAIL_ONLY='$(EMAIL_ONLY)' bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/list-auth-users.mjs'

# Promote every non-admin user to the pro tier. Walks each known non-admin
# source tier (basic, public, and the legacy starter/elite ids) so any user
# regardless of current tier ends up on pro. Admins are intentionally left
# alone. Pass DRY_RUN=1 to preview without writing.
all-to-pro:
	@echo "Promoting basic -> pro ..."
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/update-user-tier.mjs --all-from basic --tier pro $(if $(DRY_RUN),--dry-run,)'

# Delete a user (and cascade sessions/identities, clean audit_events).
# Usage: make delete-user EMAIL=foo@example.com [DRY_RUN=1] [YES=1]
delete-user:
	@if [ -z "$(EMAIL)" ]; then echo "Error: EMAIL is required (e.g. make delete-user EMAIL=foo@example.com)"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/delete-user.mjs --email $(EMAIL) $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,)'

# One-shot grant of founding_eligible=1 to existing users so they can redeem
# the founding code at checkout. Run once at cutover. Pass DRY_RUN=1 first to
# preview, then YES=1 to apply. Pass BEFORE=<iso> to freeze the cohort at a
# specific cutoff instead of "now".
seed-founders:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/seed-founders.mjs $(if $(BEFORE),--before $(BEFORE),) $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,)'

# Clear stripe_customer_id on rows that never produced a subscription —
# pre-cutover beta artifacts that would cause "No such customer" 400s the
# next time those users click Subscribe. Dry-run by default; pass APPLY=1
# to actually NULL them. Never touches rows with an active subscription.
clear-zombie-customers:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/clear-zombie-customers.mjs $(if $(APPLY),--apply,)'

# Stripe webhook health snapshot — counts of stripe_webhook_error /
# orphan / stale_skipped / payment_failed audit rows over the last 24h
# and 7d, plus all-time founding redemption + lifetime-coupon-applied
# counters. Exits non-zero if errors > 0 in the last 24h so it can be
# wired into cron with the standard "mail on non-zero exit" convention.
webhook-health:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/webhook-health.mjs'

# Backup Admin->Monitoring data files (frontend/data/monitoring.json and
# signups.json) into a timestamped tar.gz. Defaults to a dir OUTSIDE the
# repo so archives are not swept into the whole-app backup or git. Files
# are written atomically by the app, so this is safe to run live. Set
# S3_BUCKET to also upload (e.g. S3_BUCKET=s3://my-bucket/zerogex). Prunes
# local archives older than BACKUP_RETENTION_DAYS (default 30).
BACKUP_DIR ?= $(HOME)/zerogex-monitoring-backups
BACKUP_RETENTION_DAYS ?= 30
backup-monitoring:
	@if [ ! -f frontend/data/monitoring.json ] && [ ! -f frontend/data/signups.json ]; then \
		echo "No monitoring data found in frontend/data/ (nothing to back up)."; \
		exit 0; \
	fi; \
	mkdir -p "$(BACKUP_DIR)"; \
	ts=$$(date +%Y%m%d-%H%M%S); \
	archive="$(BACKUP_DIR)/monitoring-data-$$ts.tar.gz"; \
	files=""; \
	if [ -f frontend/data/monitoring.json ]; then files="$$files monitoring.json"; fi; \
	if [ -f frontend/data/signups.json ]; then files="$$files signups.json"; fi; \
	tar -czf "$$archive" -C frontend/data $$files && echo "Created $$archive"; \
	if [ -n "$(S3_BUCKET)" ]; then \
		if command -v aws >/dev/null 2>&1; then \
			echo "Uploading to $(S3_BUCKET)/ ..."; \
			aws s3 cp "$$archive" "$(S3_BUCKET)/"; \
		else \
			echo "WARNING: S3_BUCKET set but aws CLI not found; skipped upload."; \
		fi; \
	fi; \
	find "$(BACKUP_DIR)" -name 'monitoring-data-*.tar.gz' -mtime +$(BACKUP_RETENTION_DAYS) -delete; \
	echo "Backup complete. Local dir: $(BACKUP_DIR) (retention: $(BACKUP_RETENTION_DAYS) days)."

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf frontend/.next
	rm -rf frontend/node_modules/.cache
	@echo "Clean complete!"

# Copy logos from assets to public
logo:
	@echo "Copying logos from assets to public..."
	cp assets/branding/Dark_Full.svg frontend/public/logo-dark.svg
	cp assets/branding/Light_Full.svg frontend/public/logo-light.svg
	cp assets/branding/Title.svg frontend/public/title.svg
	cp assets/branding/Target.svg frontend/public/target.svg
	cp assets/branding/favicon.ico frontend/public/favicon.ico
	cp assets/branding/og-image.png frontend/public/.
	@echo "Logos copied successfully!"

# Full deployment
deploy:
	@echo "Starting full deployment..."
	@echo "1. Pulling latest changes..."
	git pull
	@echo "2. Installing dependencies..."
	cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && npm install'
	@echo "3. Copying logos..."
	@make logo
	@echo "4. Rebuilding application..."
	rm -rf frontend/.next
	cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && npm run build'
	@echo "5. Restarting PM2..."
	bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && pm2 restart zerogex-web'
	@echo "6. Saving PM2 config..."
	bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && pm2 save'
	@echo "Deployment complete!"
	@echo ""
	@make status

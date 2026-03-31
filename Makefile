.PHONY: help install dev build rebuild start stop restart logs status clean deploy logo

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
	@echo "  make clean      - Remove build artifacts"
	@echo "  make deploy     - Full deployment (pull, install, rebuild)"
	@echo "  make logo       - Copy logos from assets to public"
	@echo ""

# Install dependencies
install:
	@echo "Installing dependencies..."
	cd frontend && npm install

# Run development server
dev:
	@echo "Starting development server..."
	cd frontend && npm run dev

# Build for production
build:
	@echo "Building for production..."
	cd frontend && npm run build

# Clean build and restart
rebuild:
	@echo "Cleaning build directory..."
	rm -rf frontend/.next
	@echo "Building for production..."
	cd frontend && npm run build
	@echo "Restarting PM2 process..."
	pm2 restart zerogex-web
	@echo "Rebuild complete!"

# Start PM2 process
start:
	@echo "Starting PM2 process..."
	cd frontend && pm2 start npm --name "zerogex-web" -- start

# Stop PM2 process
stop:
	@echo "Stopping PM2 process..."
	pm2 stop zerogex-web

# Restart PM2 process
restart:
	@echo "Restarting PM2 process..."
	pm2 restart zerogex-web

# View logs
logs:
	@echo "Viewing PM2 logs (Ctrl+C to exit)..."
	pm2 logs zerogex-web

# Check PM2 status
status:
	@echo "PM2 process status:"
	pm2 status zerogex-web
	@echo ""
	@echo "Detailed info:"
	pm2 describe zerogex-web

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
	cp assets/branding/Dark_Title.svg frontend/public/title-dark.svg
	cp assets/branding/Light_Title.svg frontend/public/title-light.svg
	cp assets/branding/Dark_Title_Subtitle.svg frontend/public/title-subtitle-dark.svg
	cp assets/branding/Light_Title_Subtitle.svg frontend/public/title-subtitle-light.svg
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
	cd frontend && npm install
	@echo "3. Copying logos..."
	@make logo
	@echo "4. Rebuilding application..."
	rm -rf frontend/.next
	cd frontend && npm run build
	@echo "5. Restarting PM2..."
	pm2 restart zerogex-web
	@echo "6. Saving PM2 config..."
	pm2 save
	@echo "Deployment complete!"
	@echo ""
	@make status

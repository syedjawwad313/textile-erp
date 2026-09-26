#!/usr/bin/env bash
# ==============================================================================
# Textile & Apparel ERP + MES Platform - Contabo VPS Deployment Script
# ==============================================================================
set -e

echo "=========================================================="
echo "🚀 Starting Deployment for Textile & Apparel ERP on VPS..."
echo "=========================================================="

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 1. Verify Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or 20+ via your panel or apt."
    exit 1
fi
echo "✓ Node.js version: $(node -v)"

# 2. Verify / Install pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm || curl -fsSL https://get.pnpm.io/install.sh | sh -
fi
echo "✓ pnpm version: $(pnpm -v)"

# 3. Environment configuration check
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    if [ -f "$PROJECT_ROOT/.env.vps.example" ]; then
        echo "⚠️ .env not found. Creating .env from .env.vps.example..."
        cp "$PROJECT_ROOT/.env.vps.example" "$PROJECT_ROOT/.env"
        echo "⚠️ Please edit .env with your actual PostgreSQL password for user 'textileerp'."
    else
        echo "❌ No .env file found. Please create one with DATABASE_URL."
        exit 1
    fi
fi

# 4. Install dependencies
echo "📦 Installing monorepo dependencies..."
pnpm install

# 5. Generate Prisma Client
echo "🔧 Generating Prisma Client..."
pnpm --filter @textile-erp/database run db:generate

# 6. Push Schema to PostgreSQL (creates all tables in database textileerp)
echo "🗄️ Synchronizing PostgreSQL database schema..."
pnpm --filter @textile-erp/database run db:push

# 7. Seed Production Data (Roles, Permissions, Defects, Admin User)
echo "🌱 Seeding initial platform data..."
pnpm --filter @textile-erp/database run db:seed:prod || node packages/database/prisma/seed.js

# 8. Build Backend API and Frontend Web
echo "🏗️ Building NestJS API..."
pnpm --filter api run build

echo "🏗️ Building Next.js Web..."
pnpm --filter web run build

echo "=========================================================="
echo "✅ Build and Database Preparation Complete!"
echo "=========================================================="
echo ""
echo "To run the platform via your Panel (aaPanel / CloudPanel / CyberPanel):"
echo "  Project Path:    $PROJECT_ROOT/apps/web"
echo "  Run / Exec File: start-production.js"
echo "  Port:            3000 (proxied via Nginx to domain:80/443)"
echo ""
echo "Or start directly via PM2:"
echo "  cd $PROJECT_ROOT/apps/web && pm2 start start-production.js --name textile-erp"
echo "=========================================================="

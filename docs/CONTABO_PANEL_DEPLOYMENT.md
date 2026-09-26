# 🚀 Contabo VPS Panel Deployment Guide
### Textile & Apparel ERP + MES Platform (aaPanel / CloudPanel / CyberPanel / cPanel)

This guide walks you through deploying the complete platform on your Contabo VPS using your web panel with PostgreSQL database **`textileerp`** and username **`textileerp`**.

---

## Architecture Overview on VPS

```
                       Internet (Port 80 / 443 with SSL)
                                     │
                                     ▼
                      Panel Nginx / OpenLiteSpeed
                   (Reverse Proxy -> http://127.0.0.1:3000)
                                     │
                                     ▼
                     Next.js Web Frontend (Port 3000)
                     apps/web/start-production.js
                                     │
                 ┌───────────────────┴───────────────────┐
                 │                                       │
                 ▼                                       ▼
     Next.js Server & Pages               Embedded NestJS Backend API
    (SSR, Dashboard, MES UI)                  (Internal Port 4001)
                                                         │
                                                         ▼
                                               Local PostgreSQL (Port 5432)
                                                Database: textileerp
                                                Username: textileerp
```

> **Key Advantage**: The unified runner (`apps/web/start-production.js`) manages both Next.js and the NestJS API simultaneously. You only need **one website entry**, **one public port (3000)**, and **one SSL certificate** in your panel.

---

## Step 1: Clone Repository on VPS

Connect to your Contabo VPS via SSH or open the panel's Terminal:

```bash
cd /www/wwwroot   # For aaPanel (or /home/your-user / /var/www for CloudPanel)
git clone https://github.com/syedjawwad313/textile-erp.git
cd textile-erp
```

---

## Step 2: Configure `.env` File

Copy the VPS environment template:

```bash
cp .env.vps.example .env
nano .env
```

Set your database password for `textileerp`:

```ini
# Replace <YOUR_DB_PASSWORD> with the password set when creating textileerp in your panel
DATABASE_URL="postgresql://textileerp:<YOUR_DB_PASSWORD>@127.0.0.1:5432/textileerp?schema=public"

# Ports
PORT=3000
INTERNAL_API_PORT=4001
NODE_ENV="production"

# JWT Secrets (generate 32+ character random strings)
JWT_SECRET="generate-a-strong-jwt-secret-key-32-chars-min"
JWT_REFRESH_SECRET="generate-a-strong-refresh-secret-key-32-chars-min"
```

Save and exit (`Ctrl + O`, `Enter`, `Ctrl + X`).

---

## Step 3: Run the Automated VPS Build & Migration Script

Run the automated deployment script to install dependencies, generate Prisma, synchronize the database tables into `textileerp`, and seed initial data:

```bash
chmod +x scripts/deploy-vps.sh
./scripts/deploy-vps.sh
```

This single command will:
1. Check Node.js and ensure `pnpm` is available.
2. Install all dependencies across workspace packages.
3. Generate the Prisma Client for PostgreSQL.
4. Execute `prisma db push` to create all tables inside database `textileerp`.
5. Seed core roles, permissions, 20 defect catalog categories, and admin user (`admin@acmetextiles.com`).
6. Compile the NestJS API and Next.js frontend into production bundles.

---

## Step 4: Configure Node.js Project in Your Panel

### Option A: aaPanel (Node.js Project Manager)
1. In aaPanel, navigate to **Website** ➔ **Node project** (or open **Node.js Project Manager** from the App Store).
2. Click **Add Node Project**:
   - **Project Name**: `textile-erp`
   - **Project Path**: `/www/wwwroot/textile-erp/apps/web`
   - **Run Opt / Executable File**: `start-production.js` (or script `start`)
   - **Node Version**: Node 18 or 20
   - **Port**: `3000`
   - **Run As**: `www` (or root)
3. Under **Domain**, bind your domain name (e.g. `erp.yourdomain.com`).
4. Click **Submit** to start the service.
5. In the website settings, go to **SSL** ➔ **Let's Encrypt** ➔ Apply for free SSL.

---

### Option B: CloudPanel
1. In CloudPanel, click **+ Add Site** ➔ **Node.js Site**.
2. Set your domain name (e.g. `erp.yourdomain.com`).
3. Set:
   - **Node.js Version**: 18 or 20
   - **App Port**: `3000`
   - **Root Directory**: `/home/<user>/htdocs/textile-erp/apps/web`
   - **Entry Point**: `start-production.js`
4. Click **Save**, then issue an SSL certificate under the **SSL/TLS** tab.

---

### Option C: Direct PM2 (Works on any VPS/Panel)
If you prefer running via PM2 directly in terminal:

```bash
# Install PM2 globally if not installed
npm install -g pm2

# Start the all-in-one application
cd /path/to/textile-erp/apps/web
pm2 start start-production.js --name "textile-erp"

# Ensure PM2 restarts on VPS reboot
pm2 save
pm2 startup
```

Then in your panel, create a standard PHP/HTML reverse proxy site for your domain pointing to `http://127.0.0.1:3000`.

---

## Step 5: Verify Deployment & Login

1. Open your domain or VPS IP in the browser: `https://your-domain.com/login` (or `http://YOUR_VPS_IP:3000/login`).
2. Log in using the seeded administrator credentials:
   - **Tenant ID**: `demo-tenant-1`
   - **Email**: `admin@acmetextiles.com`
   - **Password**: `AdminPassword123!`
3. Check the live runtime health status at:
   - `https://your-domain.com/api/debug-status`
   - Shows active Node processes, port status, and real-time backend API connectivity.

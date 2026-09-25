# Render Environment Variables Reference

This document provides a comprehensive audit of all environment variables used across the Textile & Apparel ERP + MES platform.

> [!IMPORTANT]
> Never commit actual production secrets to source control. In `render.yaml`, all secret variables are either automatically generated via `generateValue: true` or marked `sync: false` to be entered securely in the Render Dashboard.

---

## Variable Classification Matrix

| Variable Name | Service | Classification | Required / Optional | Purpose | Safe Example / Format | Secret? | Render Dashboard Location |
|---|---|---|---|---|---|---|---|
| `NODE_ENV` | `erp-mes-api` | REQUIRED_PRODUCTION | Required | Sets Node runtime environment to production mode | `production` | No | Defined in `render.yaml` |
| `NODE_ENV` | `erp-mes-web` | REQUIRED_PRODUCTION | Required | Enables Next.js production optimizations | `production` | No | Defined in `render.yaml` |
| `PORT` | `erp-mes-api` | REQUIRED_PRODUCTION | Required | Network binding port for NestJS HTTP server | `10000` | No | Defined in `render.yaml` |
| `PORT` | `erp-mes-web` | REQUIRED_PRODUCTION | Required | Network binding port for Next.js HTTP server | `10000` | No | Defined in `render.yaml` |
| `DATABASE_URL` | `erp-mes-api` | REQUIRED_PRODUCTION | Required | PostgreSQL connection string for Prisma ORM | `postgresql://user:password@host/dbname?sslmode=require` | **YES** | Linked automatically from `erp-mes-postgres` |
| `JWT_SECRET` | `erp-mes-api` | REQUIRED_PRODUCTION | Required | Cryptographic secret for signing JWT access tokens | 64+ char random hex string | **YES** | Generated via `generateValue: true` or Render Environment |
| `JWT_EXPIRES_IN` | `erp-mes-api` | OPTIONAL | Optional | Access token expiration duration | `15m` | No | Defined in `render.yaml` (default: 15m) |
| `JWT_REFRESH_SECRET` | `erp-mes-api` | REQUIRED_PRODUCTION | Required | Cryptographic secret for signing refresh tokens | 64+ char random hex string | **YES** | Generated via `generateValue: true` or Render Environment |
| `JWT_REFRESH_EXPIRES_IN` | `erp-mes-api` | OPTIONAL | Optional | Refresh token lifetime | `7d` | No | Defined in `render.yaml` (default: 7d) |
| `FRONTEND_URL` | `erp-mes-api` | REQUIRED_PRODUCTION | Required | Origin URL of the deployed web frontend for CORS | `https://erp-mes-web.onrender.com` | No | Set in Render API Service Environment (`sync: false`) |
| `CORS_ALLOWED_ORIGINS` | `erp-mes-api` | OPTIONAL | Optional | Comma-separated list of additional permitted origins | `https://app.company.com,https://erp-mes-web.onrender.com` | No | Render API Service Environment |
| `NEXT_PUBLIC_API_URL` | `erp-mes-web` | REQUIRED_PRODUCTION | Required | Base URL of the NestJS API consumed by Next.js client | `https://erp-mes-api.onrender.com/api/v1` | No | Set in Render Web Service Environment (`sync: false`) |
| `REDIS_URL` | `erp-mes-api` | OPTIONAL | Optional | Redis connection URL for distributed caching/jobs | `redis://default:token@host:port` | **YES** | Render API Service Environment (optional) |
| `INIT_TENANT_ID` | `erp-mes-api` | OPTIONAL | Optional | Tenant UUID for initial master data seed | `prod-tenant-1` | No | Run via Render One-Off Job (optional) |
| `INIT_TENANT_NAME` | `erp-mes-api` | OPTIONAL | Optional | Tenant business name for initialization | `Apex Textile Group` | No | Run via Render One-Off Job (optional) |
| `INIT_ADMIN_EMAIL` | `erp-mes-api` | OPTIONAL | Optional | Initial Administrator email for tenant | `admin@company.com` | No | Run via Render One-Off Job (optional) |
| `INIT_ADMIN_PASSWORD` | `erp-mes-api` | OPTIONAL | Optional | Strong initial password for Admin user | Minimum 12 characters with symbol | **YES** | Run via Render One-Off Job (optional) |

---

## Service-Specific Configuration Guidelines

### 1. `erp-mes-api` (NestJS Backend Web Service)

- **`DATABASE_URL`**:
  - Automatically linked from `erp-mes-postgres` database using Render's `fromDatabase` Blueprint property:
    ```yaml
    - key: DATABASE_URL
      fromDatabase:
        name: erp-mes-postgres
        property: connectionString
    ```
- **`JWT_SECRET` & `JWT_REFRESH_SECRET`**:
  - Automatically generated with high-entropy cryptographic strings by Render's `generateValue: true` during Blueprint creation.
- **`FRONTEND_URL`**:
  - Must be populated once Render creates the frontend service URL (e.g., `https://erp-mes-web.onrender.com`).
  - Supports stripping trailing slashes automatically.
- **CORS Protection**:
  - In production, wildcard CORS (`*` / `true`) with credentials is explicitly prohibited. The backend restricts origins strictly to `FRONTEND_URL` and `CORS_ALLOWED_ORIGINS`.

### 2. `erp-mes-web` (Next.js Frontend Web Service)

- **`NEXT_PUBLIC_API_URL`**:
  - Must point to the deployed NestJS API service URL, including or excluding `/api/v1` (the frontend client automatically normalizes the prefix):
    - Example: `https://erp-mes-api.onrender.com/api/v1` or `https://erp-mes-api.onrender.com`
  - Required during the build phase (`next build`) so Next.js can bake the public endpoint into the browser client bundles.

---

## Safe Local Development vs. Production Rules

1. **Local Development**:
   - Variables are loaded from root `.env` (which is strictly `.gitignore`d).
   - In development mode, `http://localhost:3000` is automatically permitted in CORS alongside `FRONTEND_URL`.
2. **Production on Render**:
   - Never commit `.env` files.
   - All runtime variables are managed through Render Environment or `render.yaml`.

# TEXTILE & APPAREL ERP / MES — PHASE 0
## Forensic Repository Audit & Architecture Foundation

**Date:** 2026-08-17
**Status:** COMPLETE

---

## Part 1: Forensic Audit of Existing Repository

### 1. Existing repository architecture
**Status:** NONE (Greenfield Project)
The target repository is currently empty. There is no pre-existing code, structure, or architecture to salvage, migrate, or audit.

### 2. Existing technology stack
**Status:** NONE
No existing stack is present. 

### 3. Existing modules
**Status:** NONE

### 4. Existing reusable components
**Status:** NONE

### 5. Existing problems
**Status:** NONE
As there is no existing code, there are no legacy bugs. However, the primary problem to address is the aggressive 2.5-week timeline for the initial delivery window, requiring rigorous prioritization.

### 6. Existing technical debt
**Status:** NONE

### 7. Existing database/schema assessment
**Status:** NONE
No existing database schema was found.

### 8. Existing API assessment
**Status:** NONE

### 9. Existing frontend assessment
**Status:** NONE

---

## Part 2: Architecture Planning & Strategy

### 10. Requirements-to-system mapping
Based on the CEO's Master Technical Blueprint, the system encompasses 15 major domains. These map to the following core system bounded contexts:
- **Identity & Access Management (IAM):** Auth, Tenancy, RBAC, Users.
- **Master Data Management (MDM):** Corporate Hierarchy, Machinery, Parts, Product Costing, Suppliers, Buyers.
- **Procurement & Sourcing:** Buyer POs, OCR, Vendor POs, Materials.
- **Inventory & Logistics:** Warehouses, Bins, Lots, Rolls, Adjustments, Packing, Shipping, Export.
- **Manufacturing Execution System (MES):** Production Planning, Trim-Gate, Routing, Cutting, Sewing, WIP Tracking, QA/AQL, Floor realtime status.
- **Finance & Compliance:** Costing, Margin Guardrails, Invoicing, LCs, Certifications, Audits.

### 11. Proposed target architecture
**Paradigm:** Modular Monolith
**Backend Stack:**
- **Runtime & Framework:** Node.js + NestJS (TypeScript, strict mode).
- **API:** REST API using `/api/v1/...` with OpenAPI/Swagger documentation. DTOs and ValidationPipes enforced.
- **Realtime:** WebSockets (Socket.io) for MES/Shop Floor operator interfaces.
**Frontend Stack:**
- **Framework:** Next.js (React, TypeScript). Given the enterprise nature, Next.js for unified dashboard routing and optimized build is recommended.
- **UI/UX:** TailwindCSS + Radix/Shadcn (or similar enterprise-grade headless components) to build a premium, data-dense, and responsive experience.
**Data Layer:**
- **Primary Database:** PostgreSQL.
- **Cache / Queues:** Redis (for rate limiting, background queues, and ephemeral realtime state like machine status).
- **ORM/Query Builder:** Prisma ORM to ensure type safety and schema migrations.
**Background Jobs:** BullMQ (backed by Redis) for OCR processing, dependency-aware T&A recalculations, and notifications.
**Storage:** S3-compatible object storage abstraction for documents, POs, and IP.

### 12. Proposed module boundaries
Within the NestJS modular monolith, boundaries will be strictly maintained:
1. `iam` (Auth, Tenants, Roles, Permissions)
2. `master-data` (Companies, Factories, Styles, Materials)
3. `costing` (Versions, Material/CM/Trim costs, Approval Workflows)
4. `procurement` (VPOs, GRNs)
5. `inventory` (Transactions, Warehouses, Lots)
6. `production` (Production Orders, Operations, Trim-Gate, WIP)
7. `qa` (AQL, Defects, Inspections)
8. `logistics` (Packing, Shipping, Documents)
9. `audit` (Immutable event ledger)
10. `documents` (OCR Jobs, File Storage)

### 13. Proposed database/domain boundaries
- **Transactional Consistency:** PostgreSQL as the single source of truth.
- **Inventory Ledger:** Inventory will be modeled as an immutable double-entry ledger (Transactions) rather than simple quantity states.
- **Tenancy:** Every tenant-specific table will include a `tenant_id` column. RLS (Row Level Security) in PostgreSQL or application-level global scopes will enforce isolation.
- **Audit:** Separate audit log tables (`audit_events`) capturing `entity_type`, `entity_id`, `action`, `old_values`, `new_values`, `user_id`, `tenant_id`, and `reason`.

### 14. Multi-tenancy strategy
- **Pattern:** Logical isolation (single database, `tenant_id` on all applicable tables).
- **Enforcement:** Server-side extraction of `tenant_id` from the verified JWT token. The frontend will never dictate the tenant context for data writes/reads.
- **Hierarchy:** Tenant (Root) -> Company -> Factory Unit -> Department -> Line. Users will be assigned scopes within this hierarchy.

### 15. RBAC strategy
- **Granular Permissions:** Base roles (Admin, Merchandiser, Floor Operator) will be collections of granular permissions.
- **Structure:** `Subject` (Module/Resource), `Action` (VIEW, CREATE, APPROVE, etc.), and `Scope` (Global, Factory-level, Department-level).
- **Server Enforcement:** Custom NestJS Guards (`@RequirePermissions()`) at the controller/resolver level.

### 16. Audit strategy
- **Event-Driven:** Critical mutations (e.g., Costing Approvals, Trim-Gate Overrides, Inventory Adjustments) will emit domain events.
- **Storage:** An `audit_events` table will store the immutable JSON payload of the change, actor, and timestamp.
- **Soft Deletes:** Critical business records will use soft deletes (`deleted_at`) or specific status transitions (`CANCELED`, `VOIDED`) instead of hard SQL `DELETE`.

### 17. Document strategy
- **Abstraction:** A `DocumentService` interface wrapping AWS S3 (or similar).
- **Metadata:** Database will store document metadata, version, original filename, uploader, and associated entity (e.g., Buyer PO ID).
- **Access:** Pre-signed URLs will be generated for frontend consumption to keep the storage layer private.

### 18. OCR strategy
- **Workflow:** 
  1. Upload PDF -> Save to Storage -> Create `OcrJob` record (Status: PENDING).
  2. Background Job extracts text via OCR API (e.g., AWS Textract / Google Document AI).
  3. LLM/Parser extracts structured JSON (PO lines, items).
  4. `OcrJob` updated to `REVIEW_REQUIRED` with confidence scores.
  5. Human verifier UI presents side-by-side original PDF and extracted fields.
  6. Human approves -> Converts to actual `BuyerPo` transaction.

### 19. Realtime/MES strategy
- **WebSockets:** Used strictly for low-latency shop floor updates (e.g., operator bundle scans, machine downtime triggers).
- **State:** High-frequency events buffered in Redis and batched to PostgreSQL to prevent database connection exhaustion.
- **UX:** Distinct "Floor Interface" optimized for tablets/scanners, separated from the "Management Dashboard".

### 20. Security architecture
- **Authentication:** JWT with short-lived access tokens and httpOnly secure refresh tokens.
- **Authorization:** Strict server-side RBAC and Tenancy checks.
- **Data Protection:** bcrypt for passwords. TSL/SSL in transit. Environment variables for secrets.
- **API Guardrails:** Rate limiting via Redis. Helmet for HTTP headers.

### 21. Testing architecture
- **Unit Tests:** Jest for critical business logic (Costing calculations, T&A date shifts, Margin guardrails).
- **Integration Tests:** Supertest + Testcontainers (PostgreSQL) to verify API endpoints, Tenancy isolation, and Database constraint enforcement.
- **E2E/UI Tests:** Playwright for the critical path (PO -> Costing -> Approval -> Trim Gate).

### 22. Deployment architecture
- **Containers:** Dockerized Node.js app, Redis, and PostgreSQL.
- **Infrastructure:** Managed PostgreSQL (e.g., AWS RDS), Managed Redis, ECS/EKS or Vercel (for frontend) and Render/Fly.io (for backend) depending on client preference.
- **CI/CD:** GitHub Actions for linting, testing, and automated deployment.

### 23. Risks
- **Scope Creep:** 15 enterprise domains cannot be fully built in 2.5 weeks. 
- **Domain Complexity:** Textile costing, Trim-Gate dependencies, and MES realtime tracking are notoriously complex edge-case heavy domains.
- **OCR Reliability:** Building a robust OCR pipeline with human-in-the-loop verification takes significant effort.

### 24. Assumptions
- The 2.5-week window is for an initial "Core Commercial Flow" MVP, not the entire 15-domain suite.
- The CEO/Client will be available to answer domain-specific questions (e.g., exact margin threshold percentages, required fields for a PO).
- No legacy data migration is required (Greenfield).

### 25. Open questions
- What are the exact margin thresholds (e.g., High > 25%, Medium 15-25%, Low < 15%) for automatic vs. manual costing approval?
- Which external OCR service provider is preferred?
- Should we provide standard user/password auth or integrate with an external Identity Provider (Azure AD, Okta)?

### 26. 2.5-week implementation priorities
**Focus: P0 (Foundation) & P1 (Core Commercial Flow)**
- **Week 1:** Setup Monorepo, Database Schema (Prisma), Auth, Tenancy, RBAC, Core Entities (Companies, Users), UI Shell & Design System, Styles & BOM structure.
- **Week 2:** Costing Engine (versions, calculations, approval logic), Buyer POs, Suppliers, Procurement (VPO).
- **Final Half-Week:** T&A basics, Polish UI, End-to-End testing of the core flow, deployment to a staging environment.
*(P2, P3, P4 are explicitly deferred from the initial 2.5-week delivery)*

### 27. Definition of Done for the initial delivery
- Repository initialized with backend/frontend.
- CI/CD pipeline running lint and tests.
- Database deployed with migrations.
- Tenancy and Auth verified (cannot access cross-tenant data).
- Core P1 flow is functional: Create Style -> Create BOM -> Generate Costing -> Approve Costing -> Create PO.
- Code is documented, strictly typed, and has integration tests for the costing and tenancy logic.

# Frontend API Audit & Backend Contract Specification

This document details the audit of the Textile & Apparel ERP / MES backend API contracts, endpoints, authentication requirements, tenancy rules, RBAC permissions, request/response formats, and the corresponding frontend pages consuming them.

---

## 1. Global API Configuration

- **API Base URL**: Configurable via `NEXT_PUBLIC_API_URL` (Default: `http://localhost:3001/api/v1`)
- **Global Route Prefix**: `api/v1` (configured via NestJS `app.setGlobalPrefix('api/v1')`)
- **Authentication Mechanism**: Bearer JWT tokens in the `Authorization: Bearer <accessToken>` header.
- **Tenancy Resolution**:
  - The backend decodes the tenant from the JWT payload (`tenantId`).
  - In certain MES production endpoints, explicit `x-tenant-id` headers are supported and validated.
  - The frontend never allows users to tamper with or spoof tenant contexts.
- **RBAC Enforcement**: Evaluated by `RbacGuard` against `UserRole` -> `RolePermission` -> `Permission` (`resource:action`).

---

## 2. API Endpoint Matrix

### 2.1 Authentication (`/auth`)

| Endpoint | Method | Auth | Tenant Context | Required Permission | Request Body | Response Structure | Consuming Frontend Page |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/auth/login` | `POST` | Public | Body `tenantId` | None | `{ tenantId, email, password }` | `{ accessToken: string, refreshToken: string }` | `/login` |
| `/api/v1/auth/register` | `POST` | Public | Body `tenantId` | None | `{ tenantId, email, password, firstName, lastName }` | `{ accessToken: string, refreshToken: string }` | `/login` (Register tab) |
| `/api/v1/auth/refresh` | `POST` | Public | Derived from JWT | None | `{ refreshToken: string }` | `{ accessToken: string, refreshToken: string }` | API Client Interceptor |
| `/api/v1/auth/logout` | `POST` | Bearer JWT | JWT Payload | None | None | `{ success: boolean }` | App Shell Header / Logout |
| `/api/v1/auth/me` | `GET` | Bearer JWT | JWT Payload | None | None | `{ id, tenantId, email, firstName, lastName, isActive, createdAt }` | App Shell, Auth Provider, Profile |

---

### 2.2 Master Data Management (Commercial & MES)

#### Factory Units (`/factory-units`)
| Endpoint | Method | Auth | Tenant Context | Required Permission | Request Body | Response Structure | Consuming Frontend Page |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/factory-units` | `GET` | Bearer JWT | JWT `tenantId` | `FACTORY:READ` | None | `Array<{ id, tenantId, companyId, code, name, createdAt, updatedAt }>` | `/master-data/factories` |
| `/api/v1/factory-units` | `POST` | Bearer JWT | JWT `tenantId` | `FACTORY:WRITE` | `{ code: string, name: string, companyId: string }` | `{ id, tenantId, companyId, code, name, createdAt, updatedAt }` | `/master-data/factories` (Create Modal) |
| `/api/v1/factory-units/:id` | `GET` | Bearer JWT | JWT `tenantId` | `FACTORY:READ` | None | `{ id, tenantId, companyId, code, name, createdAt, updatedAt }` | Factory Detail / Edit |
| `/api/v1/factory-units/:id` | `PATCH` | Bearer JWT | JWT `tenantId` | `FACTORY:WRITE` | `{ name?: string }` | `{ id, tenantId, companyId, code, name, createdAt, updatedAt }` | `/master-data/factories` (Edit Modal) |

#### Production Lines (`/production-lines`)
| Endpoint | Method | Auth | Tenant Context | Required Permission | Request Body | Response Structure | Consuming Frontend Page |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/production-lines` | `GET` | Bearer JWT | JWT `tenantId` | `LINE:READ` | None | `Array<{ id, tenantId, factoryUnitId, code, name, capacity, createdAt, updatedAt }>` | `/master-data/lines` |
| `/api/v1/production-lines` | `POST` | Bearer JWT | JWT `tenantId` | `LINE:WRITE` | `{ code: string, name: string, factoryUnitId: string, capacity?: number }` | `{ id, tenantId, factoryUnitId, code, name, capacity, createdAt, updatedAt }` | `/master-data/lines` (Create Modal) |
| `/api/v1/production-lines/:id` | `GET` | Bearer JWT | JWT `tenantId` | `LINE:READ` | None | `{ id, tenantId, factoryUnitId, code, name, capacity, createdAt, updatedAt }` | Production Line Detail |
| `/api/v1/production-lines/:id` | `PATCH` | Bearer JWT | JWT `tenantId` | `LINE:WRITE` | `{ name?: string, capacity?: number }` | `{ id, tenantId, factoryUnitId, code, name, capacity, createdAt, updatedAt }` | `/master-data/lines` (Edit Modal) |

#### Machines (`/machines`)
| Endpoint | Method | Auth | Tenant Context | Required Permission | Request Body | Response Structure | Consuming Frontend Page |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/machines` | `GET` | Bearer JWT | JWT `tenantId` | `MACHINE:READ` | None | `Array<{ id, tenantId, factoryUnitId, code, name, type, createdAt, updatedAt }>` | `/master-data/machines` |
| `/api/v1/machines` | `POST` | Bearer JWT | JWT `tenantId` | `MACHINE:WRITE` | `{ code: string, name: string, type: string, factoryUnitId: string }` | `{ id, tenantId, factoryUnitId, code, name, type, createdAt, updatedAt }` | `/master-data/machines` (Create Modal) |
| `/api/v1/machines/:id` | `GET` | Bearer JWT | JWT `tenantId` | `MACHINE:READ` | None | `{ id, tenantId, factoryUnitId, code, name, type, createdAt, updatedAt }` | Machine Detail |
| `/api/v1/machines/:id` | `PATCH` | Bearer JWT | JWT `tenantId` | `MACHINE:WRITE` | `{ name?: string, type?: string }` | `{ id, tenantId, factoryUnitId, code, name, type, createdAt, updatedAt }` | `/master-data/machines` (Edit Modal) |

#### Employees (`/employees`)
| Endpoint | Method | Auth | Tenant Context | Required Permission | Request Body | Response Structure | Consuming Frontend Page |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/employees` | `GET` | Bearer JWT | JWT `tenantId` | `EMPLOYEE:READ` | None | `Array<{ id, tenantId, factoryUnitId, code, name, type: 'OPERATOR'\|'SUPERVISOR'\|'QC', createdAt, updatedAt }>` | `/master-data/employees` |
| `/api/v1/employees` | `POST` | Bearer JWT | JWT `tenantId` | `EMPLOYEE:WRITE` | `{ code: string, name: string, type: 'OPERATOR'\|'SUPERVISOR'\|'QC', factoryUnitId: string }` | `{ id, tenantId, factoryUnitId, code, name, type, createdAt, updatedAt }` | `/master-data/employees` (Create Modal) |
| `/api/v1/employees/:id` | `GET` | Bearer JWT | JWT `tenantId` | `EMPLOYEE:READ` | None | `{ id, tenantId, factoryUnitId, code, name, type, createdAt, updatedAt }` | Employee Detail |
| `/api/v1/employees/:id` | `PATCH` | Bearer JWT | JWT `tenantId` | `EMPLOYEE:WRITE` | `{ name?: string, type?: 'OPERATOR'\|'SUPERVISOR'\|'QC' }` | `{ id, tenantId, factoryUnitId, code, name, type, createdAt, updatedAt }` | `/master-data/employees` (Edit Modal) |

#### Styles (`/styles`)
| Endpoint | Method | Auth | Tenant Context | Required Permission | Request Body | Response Structure | Consuming Frontend Page |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/styles` | `GET` | Bearer JWT | JWT `tenantId` | `STYLE:READ` | None | `Array<{ id, tenantId, code, name, createdAt, updatedAt }>` | `/master-data/styles` |
| `/api/v1/styles` | `POST` | Bearer JWT | JWT `tenantId` | `STYLE:WRITE` | `{ code: string, name: string }` | `{ id, tenantId, code, name, createdAt, updatedAt }` | `/master-data/styles` (Create Modal) |
| `/api/v1/styles/:id` | `GET` | Bearer JWT | JWT `tenantId` | `STYLE:READ` | None | `{ id, tenantId, code, name, createdAt, updatedAt }` | Style Detail |
| `/api/v1/styles/:id` | `PATCH` | Bearer JWT | JWT `tenantId` | `STYLE:WRITE` | `{ name: string }` | `{ id, tenantId, code, name, createdAt, updatedAt }` | `/master-data/styles` (Edit Modal) |

#### Buyers (`/buyers`)
| Endpoint | Method | Auth | Tenant Context | Required Permission | Request Body | Response Structure | Consuming Frontend Page |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/buyers` | `GET` | Bearer JWT | JWT `tenantId` | `BUYER:READ` | None | `Array<{ id, tenantId, code, name, createdAt, updatedAt }>` | `/master-data/buyers` |
| `/api/v1/buyers` | `POST` | Bearer JWT | JWT `tenantId` | `BUYER:WRITE` | `{ code: string, name: string }` | `{ id, tenantId, code, name, createdAt, updatedAt }` | `/master-data/buyers` (Create Modal) |
| `/api/v1/buyers/:id` | `GET` | Bearer JWT | JWT `tenantId` | `BUYER:READ` | None | `{ id, tenantId, code, name, createdAt, updatedAt }` | Buyer Detail |
| `/api/v1/buyers/:id` | `PATCH` | Bearer JWT | JWT `tenantId` | `BUYER:WRITE` | `{ name: string }` | `{ id, tenantId, code, name, createdAt, updatedAt }` | `/master-data/buyers` (Edit Modal) |

#### Suppliers (`/suppliers`)
| Endpoint | Method | Auth | Tenant Context | Required Permission | Request Body | Response Structure | Consuming Frontend Page |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/suppliers` | `GET` | Bearer JWT | JWT `tenantId` | `SUPPLIER:READ` | None | `Array<{ id, tenantId, code, name, createdAt, updatedAt }>` | `/master-data/suppliers` |
| `/api/v1/suppliers` | `POST` | Bearer JWT | JWT `tenantId` | `SUPPLIER:WRITE` | `{ code: string, name: string }` | `{ id, tenantId, code, name, createdAt, updatedAt }` | `/master-data/suppliers` (Create Modal) |
| `/api/v1/suppliers/:id` | `GET` | Bearer JWT | JWT `tenantId` | `SUPPLIER:READ` | None | `{ id, tenantId, code, name, createdAt, updatedAt }` | Supplier Detail |
| `/api/v1/suppliers/:id` | `PATCH` | Bearer JWT | JWT `tenantId` | `SUPPLIER:WRITE` | `{ name: string }` | `{ id, tenantId, code, name, createdAt, updatedAt }` | `/master-data/suppliers` (Edit Modal) |

---

### 2.3 Commercial / Costing (`/costing`)

| Endpoint | Method | Auth | Tenant Context | Required Permission | Request Body | Response Structure | Consuming Frontend Page |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/costing/sheets` | `GET` | Bearer JWT | JWT `tenantId` | `COSTING:READ` | None | `Array<{ id, tenantId, styleId, season, status, versions }>` | `/costing` |
| `/api/v1/costing/sheets` | `POST` | Bearer JWT | JWT `tenantId` | `COSTING:WRITE` | `{ styleId: string, season: string }` | `CostingSheet` | `/costing` (Create Sheet) |
| `/api/v1/costing/sheets/:id/versions` | `GET` | Bearer JWT | JWT `tenantId` | `COSTING:READ` | None | `Array<CostingVersion>` | `/costing` (Version Explorer) |
| `/api/v1/costing/sheets/:id/versions` | `POST` | Bearer JWT | JWT `tenantId` | `COSTING:WRITE` | `{ versionNumber: number }` | `CostingVersion` | `/costing` (Add Version) |
| `/api/v1/costing/versions/:id/bom-lines` | `POST` | Bearer JWT | JWT `tenantId` | `COSTING:WRITE` | `{ materialId: string, consumption: number, unitPrice: number, wastagePercent: number }` | `BomLine` | `/costing` (BOM Editor) |
| `/api/v1/costing/versions/:id/calculate` | `POST` | Bearer JWT | JWT `tenantId` | `COSTING:WRITE` | `{ targetMargin: number, overheadCost: number, laborCost: number }` | `CostingCalculationResult` | `/costing` (Calculate) |
| `/api/v1/costing/versions/:id/submit` | `POST` | Bearer JWT | JWT `tenantId` | `COSTING:SUBMIT` | None | `CostingVersion` | `/costing` (Submit Action) |
| `/api/v1/costing/versions/:id/approve` | `POST` | Bearer JWT | JWT `tenantId` | `COSTING:APPROVE` | None | `CostingVersion` | `/costing` (Approve Action) |

---

### 2.4 Procurement (`/buyer-pos`, `/vpos`)

| Endpoint | Method | Auth | Tenant Context | Required Permission | Request Body | Response Structure | Consuming Frontend Page |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/buyer-pos` | `GET` | Bearer JWT | JWT `tenantId` | `BUYER_PO:READ` | None | `Array<BuyerPo>` | `/procurement` |
| `/api/v1/buyer-pos` | `POST` | Bearer JWT | JWT `tenantId` | `BUYER_PO:WRITE` | `{ poNumber, buyerId, styleId, totalQuantity, deliveryDate, lineItems }` | `BuyerPo` | `/procurement` (Create Buyer PO) |
| `/api/v1/buyer-pos/:id` | `GET` | Bearer JWT | JWT `tenantId` | `BUYER_PO:READ` | None | `BuyerPo` | `/procurement` |
| `/api/v1/vpos` | `GET` | Bearer JWT | JWT `tenantId` | `VPO:READ` | None | `Array<Vpo>` | `/procurement` (VPO tab) |
| `/api/v1/vpos` | `POST` | Bearer JWT | JWT `tenantId` | `VPO:WRITE` | `{ vpoNumber, supplierId, buyerPoId, lineItems }` | `Vpo` | `/procurement` (Create VPO) |
| `/api/v1/vpos/:id` | `GET` | Bearer JWT | JWT `tenantId` | `VPO:READ` | None | `Vpo` | `/procurement` |

---

### 2.5 Inventory & Warehousing (`/api/v1/warehouses`, `/api/v1/inventory`)

| Endpoint | Method | Auth | Tenant Context | Required Permission | Request Body | Response Structure | Consuming Frontend Page |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/warehouses` | `GET` | Bearer JWT | JWT `tenantId` | `WAREHOUSE:READ` | None | `Array<Warehouse>` | `/inventory` |
| `/api/v1/warehouses` | `POST` | Bearer JWT | JWT `tenantId` | `WAREHOUSE:WRITE` | `{ code: string, name: string }` | `Warehouse` | `/inventory` (Create Warehouse) |
| `/api/v1/warehouses/:id` | `GET` | Bearer JWT | JWT `tenantId` | `WAREHOUSE:READ` | None | `Warehouse & { bins: Bin[] }` | `/inventory` (Warehouse View) |
| `/api/v1/warehouses/:id/bins` | `POST` | Bearer JWT | JWT `tenantId` | `WAREHOUSE:WRITE` | `{ code: string, name: string }` | `Bin` | `/inventory` (Create Bin) |
| `/api/v1/inventory/receipts` | `POST` | Bearer JWT | JWT `tenantId` | `INVENTORY:WRITE` | `{ vpoId, warehouseId, binId, items }` | `ReceiptResult` | `/inventory` (Receive Stock) |
| `/api/v1/inventory/transfers` | `POST` | Bearer JWT | JWT `tenantId` | `INVENTORY:WRITE` | `{ fromBinId, toBinId, materialId, quantity }` | `TransferResult` | `/inventory` (Bin Transfer) |
| `/api/v1/inventory/adjustments` | `POST` | Bearer JWT | JWT `tenantId` | `INVENTORY:ADJUST` | `{ binId, materialId, quantity, reason }` | `AdjustmentResult` | `/inventory` (Stock Adjustment) |

---

### 2.6 Production / MES (`/production`)

| Endpoint | Method | Auth | Tenant Context | Required Permission | Request Body | Response Structure | Consuming Frontend Page |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/production/orders` | `POST` | Bearer JWT / Header | `x-tenant-id` header | Authenticated | `{ orderNumber, buyerPoId, styleId, factoryUnitId, targetQuantity, startDate, plannedEndDate, operations }` | `ProductionOrder` | `/production/orders` |
| `/api/v1/production/orders/:id/status` | `PATCH` | Bearer JWT / Header | `x-tenant-id` header | Authenticated | `{ status: ProductionStatus }` | `ProductionOrder` | `/production/orders` |
| `/api/v1/production/orders/:id/materials/issue` | `POST` | Bearer JWT / Header | `x-tenant-id` header | Authenticated | `{ materialId: string, quantity: number }` | `MaterialIssue` | `/production/orders` |
| `/api/v1/production/operations/:id/wip-move` | `POST` | Bearer JWT / Header | `x-tenant-id` header | Authenticated | `{ fromOpId, toOpId, quantity, type: 'MOVE' \| 'REJECT' }` | `WipEvent` | `/production/wip` |
| `/api/v1/production/orders/:id/output` | `POST` | Bearer JWT / Header | `x-tenant-id` header | Authenticated | `{ quantity: number }` | `ProductionOutput` | `/production/orders` |

---

## 3. RBAC Mapping for User Interface Controls

| UI Action | Target Resource | Required Permission | UI Behavior if Missing |
| :--- | :--- | :--- | :--- |
| View Factories List | `FACTORY` | `FACTORY:READ` | Displays 403 Forbidden Screen |
| Create New Factory | `FACTORY` | `FACTORY:WRITE` | Hides "+ Add Factory Unit" button |
| Edit Factory Unit | `FACTORY` | `FACTORY:WRITE` | Hides "Edit" action menu item |
| View Production Lines | `LINE` | `LINE:READ` | Displays 403 Forbidden Screen |
| Create Production Line | `LINE` | `LINE:WRITE` | Hides "+ Add Line" button |
| Edit Production Line | `LINE` | `LINE:WRITE` | Hides "Edit" action |
| View Machines | `MACHINE` | `MACHINE:READ` | Displays 403 Forbidden Screen |
| Create Machine | `MACHINE` | `MACHINE:WRITE` | Hides "+ Add Machine" button |
| Edit Machine | `MACHINE` | `MACHINE:WRITE` | Hides "Edit" action |
| View Employees | `EMPLOYEE` | `EMPLOYEE:READ` | Displays 403 Forbidden Screen |
| Create Employee | `EMPLOYEE` | `EMPLOYEE:WRITE` | Hides "+ Add Employee" button |
| Edit Employee | `EMPLOYEE` | `EMPLOYEE:WRITE` | Hides "Edit" action |
| View Commercial Data (Styles/Buyers/Suppliers) | `STYLE`/`BUYER`/`SUPPLIER` | `*:READ` | Displays 403 Forbidden Screen |
| Create Commercial Data | `STYLE`/`BUYER`/`SUPPLIER` | `*:WRITE` | Hides Create action |
| Costing Sheet Submit | `COSTING` | `COSTING:SUBMIT` | Disables "Submit for Approval" |
| Costing Sheet Approve | `COSTING` | `COSTING:APPROVE` | Disables "Approve Sheet" |
| Inventory Adjustment | `INVENTORY` | `INVENTORY:ADJUST` | Hides "Adjust Stock" button |

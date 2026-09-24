# Frontend Route Matrix

This document maps all frontend routes to their respective module, backend APIs, authentication requirements, RBAC permissions, and implementation status.

| Route | Module | Backend API | Authentication | Permission | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/login` | Authentication | `POST /api/v1/auth/login`, `POST /api/v1/auth/register` | Public | None | Implemented |
| `/dashboard` | Command Center | `GET /api/v1/factory-units`, `GET /api/v1/production-lines`, `GET /api/v1/machines`, `GET /api/v1/employees`, `GET /api/v1/costing/sheets`, `GET /api/v1/buyer-pos`, `GET /api/v1/warehouses` | Bearer JWT | None (Dashboard aggregates available tenant data) | Implemented |
| `/master-data` | Master Data Landing | Aggregates MDM resources | Bearer JWT | None (Cards check individual resource permissions) | Implemented |
| `/master-data/factories` | MES Master Data | `GET /api/v1/factory-units`, `POST /api/v1/factory-units`, `PATCH /api/v1/factory-units/:id` | Bearer JWT | `FACTORY:READ`, `FACTORY:WRITE` | Implemented |
| `/master-data/lines` | MES Master Data | `GET /api/v1/production-lines`, `POST /api/v1/production-lines`, `PATCH /api/v1/production-lines/:id` | Bearer JWT | `LINE:READ`, `LINE:WRITE` | Implemented |
| `/master-data/machines` | MES Master Data | `GET /api/v1/machines`, `POST /api/v1/machines`, `PATCH /api/v1/machines/:id` | Bearer JWT | `MACHINE:READ`, `MACHINE:WRITE` | Implemented |
| `/master-data/employees` | MES Master Data | `GET /api/v1/employees`, `POST /api/v1/employees`, `PATCH /api/v1/employees/:id` | Bearer JWT | `EMPLOYEE:READ`, `EMPLOYEE:WRITE` | Implemented |
| `/master-data/styles` | Commercial Master Data | `GET /api/v1/styles`, `POST /api/v1/styles`, `PATCH /api/v1/styles/:id` | Bearer JWT | `STYLE:READ`, `STYLE:WRITE` | Implemented |
| `/master-data/buyers` | Commercial Master Data | `GET /api/v1/buyers`, `POST /api/v1/buyers`, `PATCH /api/v1/buyers/:id` | Bearer JWT | `BUYER:READ`, `BUYER:WRITE` | Implemented |
| `/master-data/suppliers` | Commercial Master Data | `GET /api/v1/suppliers`, `POST /api/v1/suppliers`, `PATCH /api/v1/suppliers/:id` | Bearer JWT | `SUPPLIER:READ`, `SUPPLIER:WRITE` | Implemented |
| `/costing` | Commercial | `GET /api/v1/costing/sheets`, `POST /api/v1/costing/sheets`, `POST /api/v1/costing/sheets/:id/versions`, `POST /api/v1/costing/versions/:id/bom-lines`, `POST /api/v1/costing/versions/:id/calculate`, `POST /api/v1/costing/versions/:id/submit`, `POST /api/v1/costing/versions/:id/approve` | Bearer JWT | `COSTING:READ`, `COSTING:WRITE`, `COSTING:SUBMIT`, `COSTING:APPROVE` | Implemented |
| `/procurement` | Supply Chain | `GET /api/v1/buyer-pos`, `POST /api/v1/buyer-pos`, `GET /api/v1/vpos`, `POST /api/v1/vpos` | Bearer JWT | `BUYER_PO:READ`, `BUYER_PO:WRITE`, `VPO:READ`, `VPO:WRITE` | Implemented |
| `/inventory` | Supply Chain | `GET /api/v1/warehouses`, `POST /api/v1/warehouses`, `POST /api/v1/warehouses/:id/bins`, `POST /api/v1/inventory/receipts`, `POST /api/v1/inventory/transfers`, `POST /api/v1/inventory/adjustments` | Bearer JWT | `WAREHOUSE:READ`, `WAREHOUSE:WRITE`, `INVENTORY:WRITE`, `INVENTORY:ADJUST` | Implemented |

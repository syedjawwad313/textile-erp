"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarehouseService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
const prisma = new database_1.PrismaClient();
let WarehouseService = class WarehouseService {
    async createWarehouse(tenantId, dto) {
        return prisma.warehouse.create({
            data: {
                tenantId,
                code: dto.code,
                name: dto.name,
            },
        });
    }
    async getWarehouses(tenantId) {
        return prisma.warehouse.findMany({
            where: { tenantId },
            include: { bins: true },
        });
    }
    async getWarehouseById(tenantId, id) {
        const warehouse = await prisma.warehouse.findUnique({
            where: { id },
            include: { bins: true },
        });
        if (!warehouse || warehouse.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`Warehouse with ID ${id} not found`);
        }
        return warehouse;
    }
    async createBin(tenantId, warehouseId, dto) {
        await this.getWarehouseById(tenantId, warehouseId);
        return prisma.bin.create({
            data: {
                warehouseId,
                code: dto.code,
                name: dto.name,
            },
        });
    }
};
exports.WarehouseService = WarehouseService;
exports.WarehouseService = WarehouseService = __decorate([
    (0, common_1.Injectable)()
], WarehouseService);
//# sourceMappingURL=warehouse.service.js.map
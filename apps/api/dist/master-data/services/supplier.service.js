"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
let SupplierService = class SupplierService {
    async create(tenantId, dto) {
        return database_1.prisma.supplier.create({
            data: {
                tenantId,
                code: dto.code,
                name: dto.name,
            },
        });
    }
    async findAll(tenantId) {
        return database_1.prisma.supplier.findMany({ where: { tenantId } });
    }
    async findOne(tenantId, id) {
        const supplier = await database_1.prisma.supplier.findUnique({ where: { id } });
        if (!supplier || supplier.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`Supplier with id ${id} not found`);
        }
        return supplier;
    }
    async update(tenantId, id, dto) {
        await this.findOne(tenantId, id);
        return database_1.prisma.supplier.update({
            where: { id },
            data: { name: dto.name },
        });
    }
};
exports.SupplierService = SupplierService;
exports.SupplierService = SupplierService = __decorate([
    (0, common_1.Injectable)()
], SupplierService);
//# sourceMappingURL=supplier.service.js.map
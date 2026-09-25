"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FactoryUnitService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
let FactoryUnitService = class FactoryUnitService {
    async create(tenantId, dto) {
        const company = await database_1.prisma.company.findUnique({
            where: { id: dto.companyId },
        });
        if (!company || company.tenantId !== tenantId) {
            throw new common_1.BadRequestException(`Company with id ${dto.companyId} not found or doesn't belong to your tenant`);
        }
        return database_1.prisma.factoryUnit.create({
            data: {
                tenantId,
                code: dto.code,
                name: dto.name,
                companyId: dto.companyId,
            },
        });
    }
    async findAll(tenantId) {
        return database_1.prisma.factoryUnit.findMany({ where: { tenantId } });
    }
    async findOne(tenantId, id) {
        const factory = await database_1.prisma.factoryUnit.findUnique({ where: { id } });
        if (!factory || factory.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`FactoryUnit with id ${id} not found`);
        }
        return factory;
    }
    async update(tenantId, id, dto) {
        await this.findOne(tenantId, id);
        return database_1.prisma.factoryUnit.update({
            where: { id },
            data: { name: dto.name },
        });
    }
};
exports.FactoryUnitService = FactoryUnitService;
exports.FactoryUnitService = FactoryUnitService = __decorate([
    (0, common_1.Injectable)()
], FactoryUnitService);
//# sourceMappingURL=factory-unit.service.js.map
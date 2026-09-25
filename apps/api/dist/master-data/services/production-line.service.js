"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductionLineService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
let ProductionLineService = class ProductionLineService {
    async create(tenantId, dto) {
        const factory = await database_1.prisma.factoryUnit.findUnique({
            where: { id: dto.factoryUnitId },
        });
        if (!factory || factory.tenantId !== tenantId) {
            throw new common_1.BadRequestException(`FactoryUnit with id ${dto.factoryUnitId} not found or doesn't belong to your tenant`);
        }
        return database_1.prisma.productionLine.create({
            data: {
                tenantId,
                code: dto.code,
                name: dto.name,
                factoryUnitId: dto.factoryUnitId,
                capacity: dto.capacity || 0,
            },
        });
    }
    async findAll(tenantId) {
        return database_1.prisma.productionLine.findMany({ where: { tenantId } });
    }
    async findOne(tenantId, id) {
        const line = await database_1.prisma.productionLine.findUnique({ where: { id } });
        if (!line || line.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`ProductionLine with id ${id} not found`);
        }
        return line;
    }
    async update(tenantId, id, dto) {
        await this.findOne(tenantId, id);
        return database_1.prisma.productionLine.update({
            where: { id },
            data: {
                name: dto.name,
                capacity: dto.capacity,
            },
        });
    }
};
exports.ProductionLineService = ProductionLineService;
exports.ProductionLineService = ProductionLineService = __decorate([
    (0, common_1.Injectable)()
], ProductionLineService);
//# sourceMappingURL=production-line.service.js.map
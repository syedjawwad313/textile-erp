"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MachineService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
let MachineService = class MachineService {
    async create(tenantId, dto) {
        const factory = await database_1.prisma.factoryUnit.findUnique({
            where: { id: dto.factoryUnitId },
        });
        if (!factory || factory.tenantId !== tenantId) {
            throw new common_1.BadRequestException(`FactoryUnit with id ${dto.factoryUnitId} not found or doesn't belong to your tenant`);
        }
        return database_1.prisma.machine.create({
            data: {
                tenantId,
                code: dto.code,
                name: dto.name,
                type: dto.type,
                factoryUnitId: dto.factoryUnitId,
            },
        });
    }
    async findAll(tenantId) {
        return database_1.prisma.machine.findMany({ where: { tenantId } });
    }
    async findOne(tenantId, id) {
        const machine = await database_1.prisma.machine.findUnique({ where: { id } });
        if (!machine || machine.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`Machine with id ${id} not found`);
        }
        return machine;
    }
    async update(tenantId, id, dto) {
        await this.findOne(tenantId, id);
        return database_1.prisma.machine.update({
            where: { id },
            data: {
                name: dto.name,
                type: dto.type,
            },
        });
    }
};
exports.MachineService = MachineService;
exports.MachineService = MachineService = __decorate([
    (0, common_1.Injectable)()
], MachineService);
//# sourceMappingURL=machine.service.js.map
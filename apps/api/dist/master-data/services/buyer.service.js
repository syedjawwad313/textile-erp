"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuyerService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
let BuyerService = class BuyerService {
    async create(tenantId, dto) {
        return database_1.prisma.buyer.create({
            data: {
                tenantId,
                code: dto.code,
                name: dto.name,
            },
        });
    }
    async findAll(tenantId) {
        return database_1.prisma.buyer.findMany({ where: { tenantId } });
    }
    async findOne(tenantId, id) {
        const buyer = await database_1.prisma.buyer.findUnique({ where: { id } });
        if (!buyer || buyer.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`Buyer with id ${id} not found`);
        }
        return buyer;
    }
    async update(tenantId, id, dto) {
        await this.findOne(tenantId, id);
        return database_1.prisma.buyer.update({
            where: { id },
            data: { name: dto.name },
        });
    }
};
exports.BuyerService = BuyerService;
exports.BuyerService = BuyerService = __decorate([
    (0, common_1.Injectable)()
], BuyerService);
//# sourceMappingURL=buyer.service.js.map
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuyerPoService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
let BuyerPoService = class BuyerPoService {
    async create(tenantId, dto) {
        const linesData = [];
        if (dto.costingVersionId) {
            const version = await database_1.prisma.costingVersion.findUnique({
                where: { id: dto.costingVersionId },
                include: { costingSheet: true },
            });
            if (!version || version.tenantId !== tenantId) {
                throw new common_1.NotFoundException("CostingVersion not found");
            }
            if (version.status !== database_1.CostingStatus.APPROVED) {
                throw new common_1.BadRequestException("Procurement must only allow PO creation from an APPROVED costing version");
            }
            linesData.push({
                styleId: version.costingSheet.styleId,
                quantity: 1,
                unitPrice: version.sellingPrice,
                totalPrice: version.sellingPrice,
            });
        }
        if (dto.lines && dto.lines.length > 0) {
            for (const line of dto.lines) {
                const version = await database_1.prisma.costingVersion.findFirst({
                    where: {
                        tenantId,
                        status: database_1.CostingStatus.APPROVED,
                        costingSheet: { styleId: line.styleId },
                    },
                });
                if (!version) {
                    throw new common_1.BadRequestException(`No APPROVED CostingVersion found for Style ${line.styleId}`);
                }
                linesData.push({
                    styleId: line.styleId,
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                    totalPrice: Number(line.quantity) * Number(line.unitPrice),
                });
            }
        }
        if (linesData.length === 0) {
            throw new common_1.BadRequestException("PO requires either a costingVersionId or lines");
        }
        return database_1.prisma.buyerPo.create({
            data: {
                tenantId,
                buyerId: dto.buyerId,
                poNumber: dto.poNumber,
                orderDate: new Date(dto.orderDate),
                buyerPoLines: {
                    create: linesData,
                },
            },
            include: {
                buyerPoLines: true,
            },
        });
    }
    async findAll(tenantId) {
        return database_1.prisma.buyerPo.findMany({ where: { tenantId } });
    }
    async findOne(tenantId, id) {
        const po = await database_1.prisma.buyerPo.findUnique({ where: { id } });
        if (!po || po.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`BuyerPo with id ${id} not found`);
        }
        return po;
    }
};
exports.BuyerPoService = BuyerPoService;
exports.BuyerPoService = BuyerPoService = __decorate([
    (0, common_1.Injectable)()
], BuyerPoService);
//# sourceMappingURL=buyer-po.service.js.map
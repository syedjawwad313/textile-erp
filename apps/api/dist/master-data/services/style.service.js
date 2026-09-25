"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StyleService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
let StyleService = class StyleService {
    async create(tenantId, dto) {
        return database_1.prisma.style.create({
            data: {
                tenantId,
                code: dto.code,
                name: dto.name,
            },
        });
    }
    async findAll(tenantId) {
        return database_1.prisma.style.findMany({ where: { tenantId } });
    }
    async findOne(tenantId, id) {
        const style = await database_1.prisma.style.findUnique({ where: { id } });
        if (!style || style.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`Style with id ${id} not found`);
        }
        return style;
    }
    async update(tenantId, id, dto) {
        await this.findOne(tenantId, id);
        return database_1.prisma.style.update({
            where: { id },
            data: { name: dto.name },
        });
    }
};
exports.StyleService = StyleService;
exports.StyleService = StyleService = __decorate([
    (0, common_1.Injectable)()
], StyleService);
//# sourceMappingURL=style.service.js.map
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryStockAuditsDto = exports.ReconcileAuditDto = exports.RecordAuditCountsDto = exports.CreateStockAuditDto = exports.AuditCountItemDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const database_1 = require("@textile-erp/database");
class AuditCountItemDto {
}
exports.AuditCountItemDto = AuditCountItemDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AuditCountItemDto.prototype, "materialId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AuditCountItemDto.prototype, "binId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AuditCountItemDto.prototype, "fabricRollId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], AuditCountItemDto.prototype, "countedQuantity", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AuditCountItemDto.prototype, "notes", void 0);
class CreateStockAuditDto {
}
exports.CreateStockAuditDto = CreateStockAuditDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateStockAuditDto.prototype, "warehouseId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateStockAuditDto.prototype, "auditNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateStockAuditDto.prototype, "notes", void 0);
class RecordAuditCountsDto {
}
exports.RecordAuditCountsDto = RecordAuditCountsDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => AuditCountItemDto),
    __metadata("design:type", Array)
], RecordAuditCountsDto.prototype, "items", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RecordAuditCountsDto.prototype, "notes", void 0);
class ReconcileAuditDto {
}
exports.ReconcileAuditDto = ReconcileAuditDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ReconcileAuditDto.prototype, "notes", void 0);
class QueryStockAuditsDto {
}
exports.QueryStockAuditsDto = QueryStockAuditsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], QueryStockAuditsDto.prototype, "warehouseId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.StockAuditStatus),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], QueryStockAuditsDto.prototype, "status", void 0);
//# sourceMappingURL=stock-audit.dto.js.map
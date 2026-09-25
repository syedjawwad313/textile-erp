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
exports.QuerySupplierReturnsDto = exports.CreateSupplierReturnDto = exports.CreateSupplierReturnLineDto = exports.QueryVposDto = exports.CreateVpoDto = exports.UpdateVpoLineDto = exports.CreateVpoLineDto = exports.CreateBuyerPoDto = exports.CreateBuyerPoLineDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const database_1 = require("@textile-erp/database");
class CreateBuyerPoLineDto {
}
exports.CreateBuyerPoLineDto = CreateBuyerPoLineDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBuyerPoLineDto.prototype, "styleId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateBuyerPoLineDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateBuyerPoLineDto.prototype, "unitPrice", void 0);
class CreateBuyerPoDto {
}
exports.CreateBuyerPoDto = CreateBuyerPoDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBuyerPoDto.prototype, "buyerId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBuyerPoDto.prototype, "poNumber", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateBuyerPoDto.prototype, "orderDate", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBuyerPoDto.prototype, "costingVersionId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CreateBuyerPoLineDto),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CreateBuyerPoDto.prototype, "lines", void 0);
class CreateVpoLineDto {
}
exports.CreateVpoLineDto = CreateVpoLineDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateVpoLineDto.prototype, "materialId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.0001),
    __metadata("design:type", Number)
], CreateVpoLineDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateVpoLineDto.prototype, "unitCost", void 0);
class UpdateVpoLineDto {
}
exports.UpdateVpoLineDto = UpdateVpoLineDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.0001),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpdateVpoLineDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpdateVpoLineDto.prototype, "unitCost", void 0);
class CreateVpoDto {
}
exports.CreateVpoDto = CreateVpoDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateVpoDto.prototype, "supplierId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateVpoDto.prototype, "vpoNumber", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateVpoDto.prototype, "orderDate", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CreateVpoLineDto),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CreateVpoDto.prototype, "lines", void 0);
class QueryVposDto {
}
exports.QueryVposDto = QueryVposDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], QueryVposDto.prototype, "supplierId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.VpoStatus),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], QueryVposDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], QueryVposDto.prototype, "search", void 0);
class CreateSupplierReturnLineDto {
}
exports.CreateSupplierReturnLineDto = CreateSupplierReturnLineDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSupplierReturnLineDto.prototype, "materialId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateSupplierReturnLineDto.prototype, "fabricRollId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateSupplierReturnLineDto.prototype, "binId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.0001),
    __metadata("design:type", Number)
], CreateSupplierReturnLineDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateSupplierReturnLineDto.prototype, "uom", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateSupplierReturnLineDto.prototype, "reason", void 0);
class CreateSupplierReturnDto {
}
exports.CreateSupplierReturnDto = CreateSupplierReturnDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSupplierReturnDto.prototype, "supplierId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateSupplierReturnDto.prototype, "vpoId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateSupplierReturnDto.prototype, "grnId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateSupplierReturnDto.prototype, "returnNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateSupplierReturnDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CreateSupplierReturnLineDto),
    __metadata("design:type", Array)
], CreateSupplierReturnDto.prototype, "lines", void 0);
class QuerySupplierReturnsDto {
}
exports.QuerySupplierReturnsDto = QuerySupplierReturnsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], QuerySupplierReturnsDto.prototype, "supplierId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.SupplierReturnStatus),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], QuerySupplierReturnsDto.prototype, "status", void 0);
//# sourceMappingURL=procurement.dto.js.map
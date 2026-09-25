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
exports.QueryDefectCatalogDto = exports.UpdateDefectCatalogDto = exports.CreateDefectCatalogDto = void 0;
const class_validator_1 = require("class-validator");
const database_1 = require("@textile-erp/database");
class CreateDefectCatalogDto {
}
exports.CreateDefectCatalogDto = CreateDefectCatalogDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDefectCatalogDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDefectCatalogDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.DefectCategory),
    __metadata("design:type", String)
], CreateDefectCatalogDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.DefectSeverity),
    __metadata("design:type", String)
], CreateDefectCatalogDto.prototype, "defaultSeverity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDefectCatalogDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateDefectCatalogDto.prototype, "active", void 0);
class UpdateDefectCatalogDto {
}
exports.UpdateDefectCatalogDto = UpdateDefectCatalogDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateDefectCatalogDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.DefectCategory),
    __metadata("design:type", String)
], UpdateDefectCatalogDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.DefectSeverity),
    __metadata("design:type", String)
], UpdateDefectCatalogDto.prototype, "defaultSeverity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateDefectCatalogDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateDefectCatalogDto.prototype, "active", void 0);
class QueryDefectCatalogDto {
}
exports.QueryDefectCatalogDto = QueryDefectCatalogDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.DefectCategory),
    __metadata("design:type", String)
], QueryDefectCatalogDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.DefectSeverity),
    __metadata("design:type", String)
], QueryDefectCatalogDto.prototype, "severity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryDefectCatalogDto.prototype, "search", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], QueryDefectCatalogDto.prototype, "active", void 0);
//# sourceMappingURL=defect-catalog.dto.js.map
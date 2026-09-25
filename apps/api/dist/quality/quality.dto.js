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
exports.QueryInspectionsDto = exports.ReleaseQualityHoldDto = exports.ApplyQualityHoldDto = exports.CreateQualityInspectionDto = exports.RecordDefectItemDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const database_1 = require("@textile-erp/database");
class RecordDefectItemDto {
}
exports.RecordDefectItemDto = RecordDefectItemDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecordDefectItemDto.prototype, "defectCode", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.DefectSeverity),
    __metadata("design:type", String)
], RecordDefectItemDto.prototype, "severity", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], RecordDefectItemDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecordDefectItemDto.prototype, "notes", void 0);
class CreateQualityInspectionDto {
}
exports.CreateQualityInspectionDto = CreateQualityInspectionDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateQualityInspectionDto.prototype, "bundleId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateQualityInspectionDto.prototype, "operationId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateQualityInspectionDto.prototype, "inspectorId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateQualityInspectionDto.prototype, "machineId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.InspectionResult),
    __metadata("design:type", String)
], CreateQualityInspectionDto.prototype, "result", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateQualityInspectionDto.prototype, "inspectedQty", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateQualityInspectionDto.prototype, "passedQty", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateQualityInspectionDto.prototype, "rejectedQty", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => RecordDefectItemDto),
    __metadata("design:type", Array)
], CreateQualityInspectionDto.prototype, "defects", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQualityInspectionDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateQualityInspectionDto.prototype, "autoHoldOnFail", void 0);
class ApplyQualityHoldDto {
}
exports.ApplyQualityHoldDto = ApplyQualityHoldDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ApplyQualityHoldDto.prototype, "reason", void 0);
class ReleaseQualityHoldDto {
}
exports.ReleaseQualityHoldDto = ReleaseQualityHoldDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReleaseQualityHoldDto.prototype, "resolutionNotes", void 0);
class QueryInspectionsDto {
}
exports.QueryInspectionsDto = QueryInspectionsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], QueryInspectionsDto.prototype, "bundleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], QueryInspectionsDto.prototype, "productionOrderId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], QueryInspectionsDto.prototype, "operationId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], QueryInspectionsDto.prototype, "inspectorId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.InspectionResult),
    __metadata("design:type", String)
], QueryInspectionsDto.prototype, "result", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryInspectionsDto.prototype, "from", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryInspectionsDto.prototype, "to", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], QueryInspectionsDto.prototype, "limit", void 0);
//# sourceMappingURL=quality.dto.js.map
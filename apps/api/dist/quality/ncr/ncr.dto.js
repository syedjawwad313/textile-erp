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
exports.QueryNcrDto = exports.UpdateCapaActionDto = exports.CreateCapaActionDto = exports.UpdateNcrStatusDto = exports.CreateNcrDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const database_1 = require("@textile-erp/database");
class CreateNcrDto {
}
exports.CreateNcrDto = CreateNcrDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateNcrDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.NcrSource),
    __metadata("design:type", String)
], CreateNcrDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.DefectSeverity),
    __metadata("design:type", String)
], CreateNcrDto.prototype, "severity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateNcrDto.prototype, "productionOrderId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateNcrDto.prototype, "bundleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateNcrDto.prototype, "qualityInspectionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateNcrDto.prototype, "aqlAuditId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateNcrDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateNcrDto.prototype, "rootCause", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateNcrDto.prototype, "containmentAction", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateNcrDto.prototype, "createdById", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateNcrDto.prototype, "assignedToId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateNcrDto.prototype, "targetResolutionDate", void 0);
class UpdateNcrStatusDto {
}
exports.UpdateNcrStatusDto = UpdateNcrStatusDto;
__decorate([
    (0, class_validator_1.IsEnum)(database_1.NcrStatus),
    __metadata("design:type", String)
], UpdateNcrStatusDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateNcrStatusDto.prototype, "rootCause", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateNcrStatusDto.prototype, "containmentAction", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateNcrStatusDto.prototype, "resolutionNotes", void 0);
class CreateCapaActionDto {
}
exports.CreateCapaActionDto = CreateCapaActionDto;
__decorate([
    (0, class_validator_1.IsEnum)(database_1.CapaType),
    __metadata("design:type", String)
], CreateCapaActionDto.prototype, "actionType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCapaActionDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateCapaActionDto.prototype, "assigneeId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateCapaActionDto.prototype, "dueDate", void 0);
class UpdateCapaActionDto {
}
exports.UpdateCapaActionDto = UpdateCapaActionDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.CapaStatus),
    __metadata("design:type", String)
], UpdateCapaActionDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCapaActionDto.prototype, "completionNotes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateCapaActionDto.prototype, "verifiedById", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCapaActionDto.prototype, "verificationNotes", void 0);
class QueryNcrDto {
}
exports.QueryNcrDto = QueryNcrDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.NcrStatus),
    __metadata("design:type", String)
], QueryNcrDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.DefectSeverity),
    __metadata("design:type", String)
], QueryNcrDto.prototype, "severity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.NcrSource),
    __metadata("design:type", String)
], QueryNcrDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], QueryNcrDto.prototype, "productionOrderId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryNcrDto.prototype, "search", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], QueryNcrDto.prototype, "limit", void 0);
//# sourceMappingURL=ncr.dto.js.map
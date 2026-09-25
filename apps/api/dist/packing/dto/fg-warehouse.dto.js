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
exports.UpdateBinTypeDto = exports.UpdateWarehouseTypeDto = exports.QueryCartonMovementsDto = exports.QueryFgInventoryDto = exports.UnstageCartonDto = exports.StageCartonDto = exports.RelocateCartonDto = exports.PutawayCartonDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const database_1 = require("@textile-erp/database");
class PutawayCartonDto {
}
exports.PutawayCartonDto = PutawayCartonDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PutawayCartonDto.prototype, "cartonId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PutawayCartonDto.prototype, "warehouseId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PutawayCartonDto.prototype, "binId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], PutawayCartonDto.prototype, "notes", void 0);
class RelocateCartonDto {
}
exports.RelocateCartonDto = RelocateCartonDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RelocateCartonDto.prototype, "cartonId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RelocateCartonDto.prototype, "toWarehouseId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RelocateCartonDto.prototype, "toBinId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RelocateCartonDto.prototype, "notes", void 0);
class StageCartonDto {
}
exports.StageCartonDto = StageCartonDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], StageCartonDto.prototype, "cartonId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], StageCartonDto.prototype, "stagingBinId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], StageCartonDto.prototype, "notes", void 0);
class UnstageCartonDto {
}
exports.UnstageCartonDto = UnstageCartonDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UnstageCartonDto.prototype, "cartonId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UnstageCartonDto.prototype, "storageBinId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UnstageCartonDto.prototype, "notes", void 0);
class QueryFgInventoryDto {
    constructor() {
        this.page = 1;
        this.limit = 50;
    }
}
exports.QueryFgInventoryDto = QueryFgInventoryDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], QueryFgInventoryDto.prototype, "warehouseId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], QueryFgInventoryDto.prototype, "binId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], QueryFgInventoryDto.prototype, "styleId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.CartonStatus),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], QueryFgInventoryDto.prototype, "status", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], QueryFgInventoryDto.prototype, "page", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], QueryFgInventoryDto.prototype, "limit", void 0);
class QueryCartonMovementsDto {
    constructor() {
        this.limit = 50;
    }
}
exports.QueryCartonMovementsDto = QueryCartonMovementsDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], QueryCartonMovementsDto.prototype, "cartonId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.CartonMovementType),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], QueryCartonMovementsDto.prototype, "movementType", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], QueryCartonMovementsDto.prototype, "limit", void 0);
class UpdateWarehouseTypeDto {
}
exports.UpdateWarehouseTypeDto = UpdateWarehouseTypeDto;
__decorate([
    (0, class_validator_1.IsEnum)(database_1.WarehouseType),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateWarehouseTypeDto.prototype, "warehouseType", void 0);
class UpdateBinTypeDto {
}
exports.UpdateBinTypeDto = UpdateBinTypeDto;
__decorate([
    (0, class_validator_1.IsEnum)(database_1.BinType),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateBinTypeDto.prototype, "binType", void 0);
//# sourceMappingURL=fg-warehouse.dto.js.map
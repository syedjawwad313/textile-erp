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
exports.CalculateCostingDto = exports.CreateBomLineDto = exports.CreateCostingVersionDto = exports.CreateCostingSheetDto = void 0;
const class_validator_1 = require("class-validator");
class CreateCostingSheetDto {
}
exports.CreateCostingSheetDto = CreateCostingSheetDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCostingSheetDto.prototype, "styleId", void 0);
class CreateCostingVersionDto {
}
exports.CreateCostingVersionDto = CreateCostingVersionDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateCostingVersionDto.prototype, "versionNumber", void 0);
class CreateBomLineDto {
}
exports.CreateBomLineDto = CreateBomLineDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBomLineDto.prototype, "materialId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateBomLineDto.prototype, "consumption", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateBomLineDto.prototype, "wastagePercent", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateBomLineDto.prototype, "unitCost", void 0);
class CalculateCostingDto {
}
exports.CalculateCostingDto = CalculateCostingDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CalculateCostingDto.prototype, "overheads", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CalculateCostingDto.prototype, "freight", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CalculateCostingDto.prototype, "rejectionBuffer", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CalculateCostingDto.prototype, "sellingPrice", void 0);
//# sourceMappingURL=costing.dto.js.map
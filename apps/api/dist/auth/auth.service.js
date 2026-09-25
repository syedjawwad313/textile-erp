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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const database_1 = require("@textile-erp/database");
const argon2 = require("argon2");
let AuthService = class AuthService {
    constructor(jwtService) {
        this.jwtService = jwtService;
    }
    getArgonOptions() {
        return {
            type: argon2.argon2id,
            memoryCost: 65536,
            timeCost: 3,
            parallelism: 4,
        };
    }
    async register(tenantId, email, passwordPlain, firstName, lastName) {
        const existing = await database_1.prisma.user.findUnique({
            where: { tenantId_email: { tenantId, email } },
        });
        if (existing) {
            throw new common_1.ConflictException("User with this email already exists in this tenant.");
        }
        const passwordHash = await argon2.hash(passwordPlain, this.getArgonOptions());
        const user = await database_1.prisma.user.create({
            data: {
                tenantId,
                email,
                passwordHash,
                firstName,
                lastName,
            },
        });
        const payload = { sub: user.id, tenantId: user.tenantId };
        return {
            accessToken: await this.jwtService.signAsync(payload, {
                expiresIn: "15m",
            }),
            refreshToken: await this.jwtService.signAsync(payload, {
                expiresIn: "7d",
            }),
        };
    }
    async login(tenantId, email, passwordPlain) {
        const user = await database_1.prisma.user.findUnique({
            where: { tenantId_email: { tenantId, email } },
        });
        if (!user) {
            throw new common_1.UnauthorizedException("Invalid credentials");
        }
        const valid = await argon2.verify(user.passwordHash, passwordPlain);
        if (!valid) {
            throw new common_1.UnauthorizedException("Invalid credentials");
        }
        const payload = { sub: user.id, tenantId: user.tenantId };
        return {
            accessToken: await this.jwtService.signAsync(payload, {
                expiresIn: "15m",
            }),
            refreshToken: await this.jwtService.signAsync(payload, {
                expiresIn: "7d",
            }),
        };
    }
    async refresh(refreshToken) {
        try {
            const payload = await this.jwtService.verifyAsync(refreshToken);
            const newPayload = { sub: payload.sub, tenantId: payload.tenantId };
            return {
                accessToken: await this.jwtService.signAsync(newPayload, {
                    expiresIn: "15m",
                }),
                refreshToken: await this.jwtService.signAsync(newPayload, {
                    expiresIn: "7d",
                }),
            };
        }
        catch (e) {
            throw new common_1.UnauthorizedException("Invalid or expired refresh token");
        }
    }
    async getMe(userId) {
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                tenantId: true,
                email: true,
                firstName: true,
                lastName: true,
                isActive: true,
                createdAt: true,
            },
        });
        if (!user)
            throw new common_1.UnauthorizedException();
        return user;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map
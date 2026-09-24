import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { prisma } from '@textile-erp/database';
import * as argon2 from 'argon2';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  private getArgonOptions(): argon2.Options {
    // OWASP Recommended Parameters for Argon2id (Interactive/Online)
    // Memory: 64 MB, Iterations: 3, Parallelism: 4
    return {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    };
  }

  async register(tenantId: string, email: string, passwordPlain: string, firstName: string, lastName: string) {
    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } }
    });

    if (existing) {
      throw new ConflictException('User with this email already exists in this tenant.');
    }

    const passwordHash = await argon2.hash(passwordPlain, this.getArgonOptions());

    const user = await prisma.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        firstName,
        lastName,
      }
    });

    const payload = { sub: user.id, tenantId: user.tenantId };
    return {
      accessToken: await this.jwtService.signAsync(payload, { expiresIn: '15m' }),
      refreshToken: await this.jwtService.signAsync(payload, { expiresIn: '7d' })
    };
  }

  async login(tenantId: string, email: string, passwordPlain: string) {
    const user = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } }
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, passwordPlain);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, tenantId: user.tenantId };
    return {
      accessToken: await this.jwtService.signAsync(payload, { expiresIn: '15m' }),
      refreshToken: await this.jwtService.signAsync(payload, { expiresIn: '7d' })
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken);
      const newPayload = { sub: payload.sub, tenantId: payload.tenantId };
      return {
        accessToken: await this.jwtService.signAsync(newPayload, { expiresIn: '15m' }),
        refreshToken: await this.jwtService.signAsync(newPayload, { expiresIn: '7d' })
      };
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
      }
    });
    
    if (!user) throw new UnauthorizedException();
    
    return user;
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { prisma } from "@textile-erp/database";

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<string>(
      "permission",
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.sub) {
      throw new ForbiddenException("User not authenticated for RBAC");
    }

    // Split permission into resource and action (e.g., "COSTING:APPROVE")
    const [resource, action] = requiredPermission.split(":");

    // Query database to verify if user has this permission in their tenant
    const userWithRoles = await prisma.user.findUnique({
      where: { id: user.sub },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!userWithRoles) throw new ForbiddenException("User not found");

    const hasPermission = userWithRoles.userRoles.some((ur) =>
      ur.role.rolePermissions.some(
        (rp) =>
          rp.permission.resource === resource &&
          rp.permission.action === action,
      ),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Missing required permission: ${requiredPermission}`,
      );
    }

    return true;
  }
}

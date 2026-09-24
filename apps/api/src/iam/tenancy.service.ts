import { Injectable, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenancyService {
  /**
   * Verifies that the requested tenantId matches the user's tenant context.
   * This is critical to ensure users cannot manipulate URL parameters or body payloads.
   */
  verifyTenantAccess(userTenantId: string, requestedTenantId: string) {
    if (userTenantId !== requestedTenantId) {
      throw new ForbiddenException('Tenant access denied. Cross-tenant access is strictly prohibited.');
    }
  }

  /**
   * Returns the Prisma where clause for strict tenant isolation.
   */
  getTenantScope(userTenantId: string) {
    return { tenantId: userTenantId };
  }
}

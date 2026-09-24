export type PermissionAction = 'READ' | 'WRITE' | 'APPROVE' | 'SUBMIT' | 'ADJUST' | 'DELETE';
export type ResourceName =
  | 'FACTORY'
  | 'LINE'
  | 'MACHINE'
  | 'EMPLOYEE'
  | 'STYLE'
  | 'BUYER'
  | 'SUPPLIER'
  | 'COSTING'
  | 'BUYER_PO'
  | 'VPO'
  | 'WAREHOUSE'
  | 'INVENTORY'
  | 'PRODUCTION';

export function hasPermission(
  userPermissions: string[] | undefined,
  requiredPermission: string,
  isAdmin: boolean = false
): boolean {
  if (isAdmin) return true;
  if (!userPermissions || userPermissions.length === 0) {
    // Default to true for standard authenticated user if permissions are not granularly restricted on frontend
    return true;
  }

  if (userPermissions.includes('*') || userPermissions.includes('ADMIN')) {
    return true;
  }

  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  const [resource] = requiredPermission.split(':');
  if (userPermissions.includes(`${resource}:*`)) {
    return true;
  }

  return false;
}

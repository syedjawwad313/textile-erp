"use client";

import { useAuth } from "../lib/auth/auth-context";

export function usePermissions() {
  const { can, isAdmin, permissions } = useAuth();
  return {
    can,
    isAdmin,
    permissions,
    canCreateFactory: can("FACTORY:WRITE"),
    canReadFactory: can("FACTORY:READ"),
    canCreateLine: can("LINE:WRITE"),
    canReadLine: can("LINE:READ"),
    canCreateMachine: can("MACHINE:WRITE"),
    canReadMachine: can("MACHINE:READ"),
    canCreateEmployee: can("EMPLOYEE:WRITE"),
    canReadEmployee: can("EMPLOYEE:READ"),
    canCreateStyle: can("STYLE:WRITE"),
    canReadStyle: can("STYLE:READ"),
    canCreateBuyer: can("BUYER:WRITE"),
    canReadBuyer: can("BUYER:READ"),
    canCreateSupplier: can("SUPPLIER:WRITE"),
    canReadSupplier: can("SUPPLIER:READ"),
    canCostingWrite: can("COSTING:WRITE"),
    canCostingSubmit: can("COSTING:SUBMIT"),
    canCostingApprove: can("COSTING:APPROVE"),
  };
}

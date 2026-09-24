"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api/client";
import {
  FactoryUnit,
  CreateFactoryUnitInput,
  UpdateFactoryUnitInput,
  ProductionLine,
  CreateProductionLineInput,
  UpdateProductionLineInput,
  Machine,
  CreateMachineInput,
  UpdateMachineInput,
  Employee,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  Style,
  CreateStyleInput,
  UpdateStyleInput,
  Buyer,
  CreateBuyerInput,
  UpdateBuyerInput,
  Supplier,
  CreateSupplierInput,
  UpdateSupplierInput,
  CostingSheet,
  BuyerPo,
  Warehouse,
} from "../lib/api/types";
import { useAuth } from "../lib/auth/auth-context";

// ==================== FACTORY UNITS ====================
export function useFactoryUnits() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["factory-units"],
    queryFn: () => api.get<FactoryUnit[]>("/factory-units"),
    enabled: isAuthenticated,
  });
}

export function useCreateFactoryUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFactoryUnitInput) =>
      api.post<FactoryUnit>("/factory-units", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["factory-units"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useUpdateFactoryUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFactoryUnitInput }) =>
      api.patch<FactoryUnit>(`/factory-units/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["factory-units"] });
    },
  });
}

// ==================== PRODUCTION LINES ====================
export function useProductionLines() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["production-lines"],
    queryFn: () => api.get<ProductionLine[]>("/production-lines"),
    enabled: isAuthenticated,
  });
}

export function useCreateProductionLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProductionLineInput) =>
      api.post<ProductionLine>("/production-lines", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-lines"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useUpdateProductionLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductionLineInput }) =>
      api.patch<ProductionLine>(`/production-lines/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-lines"] });
    },
  });
}

// ==================== MACHINES ====================
export function useMachines() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["machines"],
    queryFn: () => api.get<Machine[]>("/machines"),
    enabled: isAuthenticated,
  });
}

export function useCreateMachine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMachineInput) =>
      api.post<Machine>("/machines", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useUpdateMachine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMachineInput }) =>
      api.patch<Machine>(`/machines/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
    },
  });
}

// ==================== EMPLOYEES ====================
export function useEmployees() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["employees"],
    queryFn: () => api.get<Employee[]>("/employees"),
    enabled: isAuthenticated,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEmployeeInput) =>
      api.post<Employee>("/employees", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEmployeeInput }) =>
      api.patch<Employee>(`/employees/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
  });
}

// ==================== STYLES ====================
export function useStyles() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["styles"],
    queryFn: () => api.get<Style[]>("/styles"),
    enabled: isAuthenticated,
  });
}

export function useCreateStyle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStyleInput) => api.post<Style>("/styles", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["styles"] });
    },
  });
}

export function useUpdateStyle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStyleInput }) =>
      api.patch<Style>(`/styles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["styles"] });
    },
  });
}

// ==================== BUYERS ====================
export function useBuyers() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["buyers"],
    queryFn: () => api.get<Buyer[]>("/buyers"),
    enabled: isAuthenticated,
  });
}

export function useCreateBuyer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBuyerInput) => api.post<Buyer>("/buyers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyers"] });
    },
  });
}

export function useUpdateBuyer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBuyerInput }) =>
      api.patch<Buyer>(`/buyers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyers"] });
    },
  });
}

// ==================== SUPPLIERS ====================
export function useSuppliers() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.get<Supplier[]>("/suppliers"),
    enabled: isAuthenticated,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSupplierInput) =>
      api.post<Supplier>("/suppliers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSupplierInput }) =>
      api.patch<Supplier>(`/suppliers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });
}

// ==================== DASHBOARD SUMMARY HOOK ====================
export function useDashboardSummary() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const [
        factories,
        lines,
        machines,
        employees,
        styles,
        buyers,
        suppliers,
        costingSheets,
        buyerPos,
        warehouses,
      ] = await Promise.all([
        api.get<FactoryUnit[]>("/factory-units").catch(() => []),
        api.get<ProductionLine[]>("/production-lines").catch(() => []),
        api.get<Machine[]>("/machines").catch(() => []),
        api.get<Employee[]>("/employees").catch(() => []),
        api.get<Style[]>("/styles").catch(() => []),
        api.get<Buyer[]>("/buyers").catch(() => []),
        api.get<Supplier[]>("/suppliers").catch(() => []),
        api.get<CostingSheet[]>("/costing/sheets").catch(() => []),
        api.get<BuyerPo[]>("/buyer-pos").catch(() => []),
        api.get<Warehouse[]>("/warehouses").catch(() => []),
      ]);

      const totalLinesCapacity = lines.reduce((acc, l) => acc + (l.capacity || 0), 0);
      const pendingCostingApprovals = costingSheets.filter((c) => c.status === "SUBMITTED").length;

      return {
        factoriesCount: factories.length,
        linesCount: lines.length,
        machinesCount: machines.length,
        employeesCount: employees.length,
        stylesCount: styles.length,
        buyersCount: buyers.length,
        suppliersCount: suppliers.length,
        totalLinesCapacity,
        pendingCostingApprovals,
        costingSheetsCount: costingSheets.length,
        buyerPosCount: buyerPos.length,
        warehousesCount: warehouses.length,
        recentFactories: factories.slice(0, 5),
        recentLines: lines.slice(0, 5),
        recentMachines: machines.slice(0, 5),
        recentEmployees: employees.slice(0, 5),
      };
    },
    enabled: isAuthenticated,
  });
}

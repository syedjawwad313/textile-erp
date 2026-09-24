"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productionApi } from "../lib/api/client";
import {
  ProductionOrder,
  ProductionPlan,
  PlanProductionOrderInput,
  CuttingRecord,
  CreateCuttingRecordInput,
} from "../lib/api/types";

export function useProductionOrders() {
  return useQuery<ProductionOrder[]>({
    queryKey: ["production-orders"],
    queryFn: async () => {
      return (await productionApi.getOrders()) as ProductionOrder[];
    },
  });
}

export function useProductionOrder(id?: string) {
  return useQuery<ProductionOrder>({
    queryKey: ["production-order", id],
    queryFn: async () => {
      if (!id) throw new Error("Order ID is required");
      return (await productionApi.getOrderById(id)) as ProductionOrder;
    },
    enabled: !!id,
  });
}

export function useProductionPlans(lineId?: string, orderId?: string) {
  return useQuery<ProductionPlan[]>({
    queryKey: ["production-plans", { lineId, orderId }],
    queryFn: async () => {
      return (await productionApi.getPlans(lineId, orderId)) as ProductionPlan[];
    },
  });
}

export function usePlanProductionOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
      idempotencyKey,
    }: {
      id: string;
      data: PlanProductionOrderInput;
      idempotencyKey?: string;
    }) => {
      return await productionApi.planOrder(id, data, idempotencyKey);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
      queryClient.invalidateQueries({ queryKey: ["production-plans"] });
    },
  });
}

export function useCuttingRecords(productionOrderId?: string) {
  return useQuery<CuttingRecord[]>({
    queryKey: ["cutting-records", { productionOrderId }],
    queryFn: async () => {
      return (await productionApi.getCuttingRecords(
        productionOrderId
      )) as CuttingRecord[];
    },
  });
}

export function useCreateCuttingRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      data,
      idempotencyKey,
    }: {
      data: CreateCuttingRecordInput;
      idempotencyKey?: string;
    }) => {
      return (await productionApi.createCuttingRecord(
        data,
        idempotencyKey
      )) as CuttingRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cutting-records"] });
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useOrderPipeline(orderId?: string) {
  return useQuery({
    queryKey: ["order-pipeline", orderId],
    queryFn: async () => {
      if (!orderId) throw new Error("Order ID is required");
      return await productionApi.getOrderPipeline(orderId);
    },
    enabled: !!orderId,
  });
}


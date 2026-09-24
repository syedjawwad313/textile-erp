"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productionApi } from "../lib/api/client";
import { ProductionDefect, CreateProductionDefectInput, DefectStatus } from "../lib/api/types";

export function useProductionDefects(filters?: {
  productionOrderId?: string;
  bundleId?: string;
  operationId?: string;
  status?: DefectStatus;
  limit?: number;
}) {
  return useQuery<ProductionDefect[]>({
    queryKey: ["production-defects", filters],
    queryFn: async () => {
      return (await productionApi.getDefects(filters)) as ProductionDefect[];
    },
    refetchInterval: 5000,
  });
}

export function useCreateProductionDefect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      data,
      idempotencyKey,
    }: {
      data: CreateProductionDefectInput;
      idempotencyKey?: string;
    }) => {
      return (await productionApi.createDefect(data, idempotencyKey)) as ProductionDefect;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-defects"] });
      queryClient.invalidateQueries({ queryKey: ["production-outputs"] });
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
    },
  });
}

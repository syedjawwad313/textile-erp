"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productionApi } from "../lib/api/client";
import { ProductionOutput, RecordProductionOutputInput } from "../lib/api/types";

export function useProductionOutputs(filters?: {
  productionOrderId?: string;
  bundleId?: string;
  operationId?: string;
  limit?: number;
}) {
  return useQuery<ProductionOutput[]>({
    queryKey: ["production-outputs", filters],
    queryFn: async () => {
      return (await productionApi.getOutputs(filters)) as ProductionOutput[];
    },
    refetchInterval: 5000,
  });
}

export function useRecordProductionOutput() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      data,
      idempotencyKey,
    }: {
      data: RecordProductionOutputInput;
      idempotencyKey?: string;
    }) => {
      return (await productionApi.recordOutput(data, idempotencyKey)) as ProductionOutput;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-outputs"] });
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
      queryClient.invalidateQueries({ queryKey: ["production-order"] });
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      queryClient.invalidateQueries({ queryKey: ["bundle"] });
      queryClient.invalidateQueries({ queryKey: ["production-defects"] });
    },
  });
}

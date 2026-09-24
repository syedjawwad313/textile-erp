"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productionApi } from "../lib/api/client";
import { QualityHold, CreateQualityHoldInput, ReleaseQualityHoldPayload, QualityHoldStatus } from "../lib/api/types";

export function useQualityHolds(filters?: {
  productionOrderId?: string;
  bundleId?: string;
  status?: QualityHoldStatus;
  limit?: number;
}) {
  return useQuery<QualityHold[]>({
    queryKey: ["quality-holds", filters],
    queryFn: async () => {
      return (await productionApi.getQualityHolds(filters)) as QualityHold[];
    },
    refetchInterval: 5000,
  });
}

export function useCreateQualityHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      data,
      idempotencyKey,
    }: {
      data: CreateQualityHoldInput;
      idempotencyKey?: string;
    }) => {
      return (await productionApi.createQualityHold(data, idempotencyKey)) as QualityHold;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-holds"] });
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      queryClient.invalidateQueries({ queryKey: ["bundle"] });
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
    },
  });
}

export function useReleaseQualityHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
      idempotencyKey,
    }: {
      id: string;
      data: ReleaseQualityHoldPayload;
      idempotencyKey?: string;
    }) => {
      return (await productionApi.releaseQualityHold(id, data, idempotencyKey)) as QualityHold;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-holds"] });
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      queryClient.invalidateQueries({ queryKey: ["bundle"] });
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
    },
  });
}

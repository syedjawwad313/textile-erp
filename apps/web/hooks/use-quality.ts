"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qualityApi } from "../lib/api/client";
import {
  QualityInspection,
  CreateQualityInspectionInput,
  ApplyQualityHoldInput,
  ReleaseQualityHoldInput,
  QualityDefectStats,
  BundleQualityHistory,
  Bundle,
} from "../lib/api/types";

export function useQualityInspections(filters?: {
  bundleId?: string;
  productionOrderId?: string;
  operationId?: string;
  inspectorId?: string;
  result?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  return useQuery<QualityInspection[]>({
    queryKey: ["quality-inspections", filters],
    queryFn: async () => {
      return (await qualityApi.getInspections(filters)) as QualityInspection[];
    },
    refetchInterval: 10000,
  });
}

export function useQualityInspection(id?: string) {
  return useQuery<QualityInspection>({
    queryKey: ["quality-inspection", id],
    queryFn: async () => {
      if (!id) throw new Error("Inspection ID is required");
      return (await qualityApi.getInspectionById(id)) as QualityInspection;
    },
    enabled: !!id,
  });
}

export function useCreateQualityInspection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      data,
      idempotencyKey,
    }: {
      data: CreateQualityInspectionInput;
      idempotencyKey?: string;
    }) => {
      return (await qualityApi.createInspection(data, idempotencyKey)) as QualityInspection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-inspections"] });
      queryClient.invalidateQueries({ queryKey: ["quality-stats"] });
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      queryClient.invalidateQueries({ queryKey: ["bundle-scans"] });
    },
  });
}

export function useApplyQualityHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bundleId,
      data,
      idempotencyKey,
    }: {
      bundleId: string;
      data: ApplyQualityHoldInput;
      idempotencyKey?: string;
    }) => {
      return (await qualityApi.applyHold(bundleId, data, idempotencyKey)) as Bundle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      queryClient.invalidateQueries({ queryKey: ["quality-inspections"] });
    },
  });
}

export function useReleaseQualityHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bundleId,
      data,
      idempotencyKey,
    }: {
      bundleId: string;
      data: ReleaseQualityHoldInput;
      idempotencyKey?: string;
    }) => {
      return (await qualityApi.releaseHold(bundleId, data, idempotencyKey)) as Bundle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      queryClient.invalidateQueries({ queryKey: ["quality-inspections"] });
    },
  });
}

export function useQualityDefectStats(productionOrderId?: string) {
  return useQuery<QualityDefectStats>({
    queryKey: ["quality-stats", productionOrderId],
    queryFn: async () => {
      return (await qualityApi.getDefectStats(productionOrderId)) as QualityDefectStats;
    },
    refetchInterval: 15000,
  });
}

export function useBundleQualityHistory(bundleId?: string) {
  return useQuery<BundleQualityHistory>({
    queryKey: ["bundle-quality-history", bundleId],
    queryFn: async () => {
      if (!bundleId) throw new Error("Bundle ID is required");
      return (await qualityApi.getBundleHistory(bundleId)) as BundleQualityHistory;
    },
    enabled: !!bundleId,
  });
}

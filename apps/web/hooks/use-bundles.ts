"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { bundlesApi } from "../lib/api/client";
import { Bundle, BundleScan, GenerateBundlesInput, ScanBundleInput, BundleStatus } from "../lib/api/types";

export function useBundles(filters?: {
  cuttingRecordId?: string;
  productionOrderId?: string;
  barcode?: string;
  status?: BundleStatus;
}) {
  return useQuery<Bundle[]>({
    queryKey: ["bundles", filters],
    queryFn: async () => {
      return (await bundlesApi.getAll(filters)) as Bundle[];
    },
  });
}

export function useBundle(id?: string) {
  return useQuery<Bundle>({
    queryKey: ["bundle", id],
    queryFn: async () => {
      if (!id) throw new Error("Bundle ID is required");
      return (await bundlesApi.getById(id)) as Bundle;
    },
    enabled: !!id,
  });
}

export function useBundleScans(filters?: {
  bundleId?: string;
  operationId?: string;
  employeeId?: string;
  limit?: number;
}) {
  return useQuery<BundleScan[]>({
    queryKey: ["bundle-scans", filters],
    queryFn: async () => {
      return (await bundlesApi.getScans(filters)) as BundleScan[];
    },
    refetchInterval: 5000,
  });
}

export function useGenerateBundles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      data,
      idempotencyKey,
    }: {
      data: GenerateBundlesInput;
      idempotencyKey?: string;
    }) => {
      return (await bundlesApi.generate(data, idempotencyKey)) as Bundle[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      queryClient.invalidateQueries({ queryKey: ["cutting-records"] });
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
    },
  });
}

export function useScanBundle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      data,
      idempotencyKey,
    }: {
      data: ScanBundleInput;
      idempotencyKey?: string;
    }) => {
      return (await bundlesApi.scan(data, idempotencyKey)) as BundleScan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      queryClient.invalidateQueries({ queryKey: ["bundle-scans"] });
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
    },
  });
}

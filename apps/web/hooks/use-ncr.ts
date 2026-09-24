"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ncrApi } from "../lib/api/client";
import {
  NonConformanceReport,
  CreateNcrInput,
  UpdateNcrStatusInput,
  CapaAction,
  CreateCapaActionInput,
  UpdateCapaActionInput,
} from "../lib/api/types";

export function useNcrs(params?: {
  status?: string;
  severity?: string;
  source?: string;
  productionOrderId?: string;
  search?: string;
  limit?: number;
}) {
  return useQuery<NonConformanceReport[]>({
    queryKey: ["ncrs", params],
    queryFn: async () => {
      return (await ncrApi.getAll(params)) as NonConformanceReport[];
    },
    refetchInterval: 10000,
  });
}

export function useNcr(id?: string) {
  return useQuery<NonConformanceReport>({
    queryKey: ["ncr", id],
    queryFn: async () => {
      if (!id) throw new Error("NCR ID required");
      return (await ncrApi.getById(id)) as NonConformanceReport;
    },
    enabled: !!id,
  });
}

export function useCreateNcr() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      data,
      idempotencyKey,
    }: {
      data: CreateNcrInput;
      idempotencyKey?: string;
    }) => {
      return (await ncrApi.create(data, idempotencyKey)) as NonConformanceReport;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ncrs"] });
    },
  });
}

export function useUpdateNcrStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateNcrStatusInput;
    }) => {
      return (await ncrApi.updateStatus(id, data)) as NonConformanceReport;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ncrs"] });
      queryClient.invalidateQueries({ queryKey: ["ncr"] });
    },
  });
}

export function useAddCapaAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ncrId,
      data,
    }: {
      ncrId: string;
      data: CreateCapaActionInput;
    }) => {
      return (await ncrApi.addCapaAction(ncrId, data)) as CapaAction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ncrs"] });
      queryClient.invalidateQueries({ queryKey: ["ncr"] });
    },
  });
}

export function useUpdateCapaAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ncrId,
      capaId,
      data,
    }: {
      ncrId: string;
      capaId: string;
      data: UpdateCapaActionInput;
    }) => {
      return (await ncrApi.updateCapaAction(ncrId, capaId, data)) as CapaAction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ncrs"] });
      queryClient.invalidateQueries({ queryKey: ["ncr"] });
    },
  });
}

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { aqlApi } from "../lib/api/client";
import {
  AqlAudit,
  AqlSamplingPlan,
  CreateAqlAuditInput,
} from "../lib/api/types";

export function useAqlCalculation(params: {
  lotSize: number;
  inspectionLevel?: string;
  aqlMajor?: number;
  aqlMinor?: number;
}) {
  return useQuery<AqlSamplingPlan>({
    queryKey: ["aql-calculation", params],
    queryFn: async () => {
      return (await aqlApi.calculate(params)) as AqlSamplingPlan;
    },
    enabled: params.lotSize > 0,
  });
}

export function useAqlAudits(params?: {
  productionOrderId?: string;
  status?: string;
  stage?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  return useQuery<AqlAudit[]>({
    queryKey: ["aql-audits", params],
    queryFn: async () => {
      return (await aqlApi.getAll(params)) as AqlAudit[];
    },
    refetchInterval: 10000,
  });
}

export function useAqlAudit(id?: string) {
  return useQuery<AqlAudit>({
    queryKey: ["aql-audit", id],
    queryFn: async () => {
      if (!id) throw new Error("Audit ID required");
      return (await aqlApi.getById(id)) as AqlAudit;
    },
    enabled: !!id,
  });
}

export function useRecordAqlAudit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      data,
      idempotencyKey,
    }: {
      data: CreateAqlAuditInput;
      idempotencyKey?: string;
    }) => {
      return (await aqlApi.recordAudit(data, idempotencyKey)) as AqlAudit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aql-audits"] });
      queryClient.invalidateQueries({ queryKey: ["quality-holds"] });
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
    },
  });
}

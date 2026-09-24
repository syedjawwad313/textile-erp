"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productionSchedulingApi } from "../lib/api/client";
import {
  ProductionSchedule,
  CreateProductionScheduleInput,
  UpdateProductionScheduleInput,
  QueryScheduleParams,
  QueryCapacityParams,
  LineCapacityMetric,
  ScheduleConflictReport,
} from "../lib/api/types";

export function useProductionSchedules(params?: QueryScheduleParams) {
  return useQuery<ProductionSchedule[]>({
    queryKey: ["production-schedules", params],
    queryFn: async () => {
      return (await productionSchedulingApi.getAll(params)) as ProductionSchedule[];
    },
  });
}

export function useProductionSchedule(id: string) {
  return useQuery<ProductionSchedule>({
    queryKey: ["production-schedule", id],
    queryFn: async () => {
      return (await productionSchedulingApi.getById(id)) as ProductionSchedule;
    },
    enabled: !!id,
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      data,
      idempotencyKey,
    }: {
      data: CreateProductionScheduleInput;
      idempotencyKey?: string;
    }) => {
      return (await productionSchedulingApi.create(
        data,
        idempotencyKey
      )) as ProductionSchedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["line-capacity"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-conflicts"] });
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateProductionScheduleInput;
    }) => {
      return (await productionSchedulingApi.update(id, data)) as ProductionSchedule;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["production-schedules"] });
      queryClient.invalidateQueries({
        queryKey: ["production-schedule", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["line-capacity"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-conflicts"] });
    },
  });
}

export function useLineCapacity(params?: QueryCapacityParams, refetchInterval = 15000) {
  return useQuery<LineCapacityMetric[]>({
    queryKey: ["line-capacity", params],
    queryFn: async () => {
      return (await productionSchedulingApi.getCapacity(params)) as LineCapacityMetric[];
    },
    refetchInterval,
  });
}

export function useScheduleConflicts(
  params?: { productionLineId?: string; from?: string; to?: string },
  refetchInterval = 20000
) {
  return useQuery<ScheduleConflictReport>({
    queryKey: ["schedule-conflicts", params],
    queryFn: async () => {
      return (await productionSchedulingApi.getConflicts(
        params
      )) as ScheduleConflictReport;
    },
    refetchInterval,
  });
}

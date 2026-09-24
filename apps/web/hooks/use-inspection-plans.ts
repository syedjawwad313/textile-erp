"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inspectionPlansApi } from "../lib/api/client";
import {
  InspectionPlan,
  CreateInspectionPlanInput,
  UpdateInspectionPlanInput,
} from "../lib/api/types";

export function useInspectionPlans(params?: {
  styleId?: string;
  stage?: string;
  active?: boolean;
  search?: string;
}) {
  return useQuery<InspectionPlan[]>({
    queryKey: ["inspection-plans", params],
    queryFn: async () => {
      return (await inspectionPlansApi.getAll(params)) as InspectionPlan[];
    },
    refetchInterval: 15000,
  });
}

export function useInspectionPlan(id?: string) {
  return useQuery<InspectionPlan>({
    queryKey: ["inspection-plan", id],
    queryFn: async () => {
      if (!id) throw new Error("Plan ID required");
      return (await inspectionPlansApi.getById(id)) as InspectionPlan;
    },
    enabled: !!id,
  });
}

export function useCreateInspectionPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateInspectionPlanInput) => {
      return (await inspectionPlansApi.create(data)) as InspectionPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspection-plans"] });
    },
  });
}

export function useUpdateInspectionPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateInspectionPlanInput;
    }) => {
      return (await inspectionPlansApi.update(id, data)) as InspectionPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspection-plans"] });
    },
  });
}

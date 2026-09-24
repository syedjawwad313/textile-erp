"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shiftsApi } from "../lib/api/client";
import {
  Shift,
  CreateShiftInput,
  UpdateShiftInput,
  ShiftAssignment,
  CreateShiftAssignmentInput,
} from "../lib/api/types";

export function useShifts(params?: { factoryUnitId?: string; active?: boolean }) {
  return useQuery<Shift[]>({
    queryKey: ["shifts", params],
    queryFn: async () => {
      return (await shiftsApi.getAll(params)) as Shift[];
    },
  });
}

export function useShift(id: string) {
  return useQuery<Shift>({
    queryKey: ["shift", id],
    queryFn: async () => {
      return (await shiftsApi.getById(id)) as Shift;
    },
    enabled: !!id,
  });
}

export function useCreateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateShiftInput) => {
      return (await shiftsApi.create(data)) as Shift;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
}

export function useUpdateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateShiftInput }) => {
      return (await shiftsApi.update(id, data)) as Shift;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["shift", variables.id] });
    },
  });
}

export function useShiftAssignments(
  shiftId: string,
  params?: { workDate?: string; productionLineId?: string; employeeId?: string }
) {
  return useQuery<ShiftAssignment[]>({
    queryKey: ["shift-assignments", shiftId, params],
    queryFn: async () => {
      return (await shiftsApi.getAssignments(shiftId, params)) as ShiftAssignment[];
    },
    enabled: !!shiftId,
  });
}

export function useCreateShiftAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      shiftId,
      data,
    }: {
      shiftId: string;
      data: CreateShiftAssignmentInput;
    }) => {
      return (await shiftsApi.createAssignment(shiftId, data)) as ShiftAssignment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["shift-assignments", variables.shiftId],
      });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
}

export function useDeleteShiftAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      shiftId,
      assignmentId,
    }: {
      shiftId: string;
      assignmentId: string;
    }) => {
      return (await shiftsApi.deleteAssignment(shiftId, assignmentId)) as {
        success: boolean;
        deletedId: string;
      };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["shift-assignments", variables.shiftId],
      });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
}

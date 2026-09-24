"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { downtimeApi } from "../lib/api/client";
import {
  DowntimeEvent,
  CreateDowntimeEventInput,
  ResolveDowntimeEventInput,
  DowntimeStatus,
} from "../lib/api/types";

export function useDowntimeEvents(filters?: {
  productionLineId?: string;
  machineId?: string;
  status?: DowntimeStatus;
  from?: string;
  to?: string;
}) {
  return useQuery<DowntimeEvent[]>({
    queryKey: ["downtime-events", filters],
    queryFn: async () => {
      return (await downtimeApi.getAll(filters)) as DowntimeEvent[];
    },
    refetchInterval: 10000,
  });
}

export function useDowntimeEvent(id?: string) {
  return useQuery<DowntimeEvent>({
    queryKey: ["downtime-event", id],
    queryFn: async () => {
      if (!id) throw new Error("Event ID is required");
      return (await downtimeApi.getById(id)) as DowntimeEvent;
    },
    enabled: !!id,
  });
}

export function useCreateDowntimeEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      data,
      idempotencyKey,
    }: {
      data: CreateDowntimeEventInput;
      idempotencyKey?: string;
    }) => {
      return (await downtimeApi.create(data, idempotencyKey)) as DowntimeEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["downtime-events"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useResolveDowntimeEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: ResolveDowntimeEventInput;
    }) => {
      return (await downtimeApi.resolve(id, data)) as DowntimeEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["downtime-events"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

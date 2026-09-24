"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { defectCatalogApi } from "../lib/api/client";
import {
  DefectCatalog,
  CreateDefectCatalogInput,
  UpdateDefectCatalogInput,
} from "../lib/api/types";

export function useDefectCatalog(params?: {
  category?: string;
  severity?: string;
  active?: boolean;
  search?: string;
}) {
  return useQuery<DefectCatalog[]>({
    queryKey: ["defect-catalog", params],
    queryFn: async () => {
      return (await defectCatalogApi.getAll(params)) as DefectCatalog[];
    },
    refetchInterval: 15000,
  });
}

export function useDefectCode(id?: string) {
  return useQuery<DefectCatalog>({
    queryKey: ["defect-code", id],
    queryFn: async () => {
      if (!id) throw new Error("Defect ID required");
      return (await defectCatalogApi.getById(id)) as DefectCatalog;
    },
    enabled: !!id,
  });
}

export function useCreateDefectCatalog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateDefectCatalogInput) => {
      return (await defectCatalogApi.create(data)) as DefectCatalog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["defect-catalog"] });
    },
  });
}

export function useUpdateDefectCatalog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateDefectCatalogInput;
    }) => {
      return (await defectCatalogApi.update(id, data)) as DefectCatalog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["defect-catalog"] });
    },
  });
}

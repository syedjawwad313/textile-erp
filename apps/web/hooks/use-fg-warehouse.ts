import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fgWarehouseApi } from '../lib/api/client';
import { useAuth } from '../lib/auth/auth-context';
import {
  PutawayCartonInput,
  RelocateCartonInput,
  StageCartonInput,
  UnstageCartonInput,
  UpdateWarehouseTypeInput,
  UpdateBinTypeInput,
} from '../lib/api/types';

export function useFgWarehouses() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['fg-warehouses'],
    queryFn: () => fgWarehouseApi.getWarehouses(),
    enabled: isAuthenticated,
  });
}

export function useUpdateWarehouseType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWarehouseTypeInput }) =>
      fgWarehouseApi.updateWarehouseType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fg-warehouses'] });
    },
  });
}

export function useUpdateBinType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBinTypeInput }) =>
      fgWarehouseApi.updateBinType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fg-warehouses'] });
    },
  });
}

export function usePutawayCarton() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      data,
      idempotencyKey,
    }: {
      data: PutawayCartonInput;
      idempotencyKey?: string;
    }) => fgWarehouseApi.putawayCarton(data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fg-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['cartons'] });
      queryClient.invalidateQueries({ queryKey: ['carton-movements'] });
      queryClient.invalidateQueries({ queryKey: ['fg-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['fg-warehouses'] });
    },
  });
}

export function useRelocateCarton() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      data,
      idempotencyKey,
    }: {
      data: RelocateCartonInput;
      idempotencyKey?: string;
    }) => fgWarehouseApi.relocateCarton(data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fg-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['cartons'] });
      queryClient.invalidateQueries({ queryKey: ['carton-movements'] });
      queryClient.invalidateQueries({ queryKey: ['fg-warehouses'] });
    },
  });
}

export function useStageCarton() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      data,
      idempotencyKey,
    }: {
      data: StageCartonInput;
      idempotencyKey?: string;
    }) => fgWarehouseApi.stageCarton(data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fg-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['cartons'] });
      queryClient.invalidateQueries({ queryKey: ['carton-movements'] });
      queryClient.invalidateQueries({ queryKey: ['fg-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['fg-warehouses'] });
    },
  });
}

export function useUnstageCarton() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      data,
      idempotencyKey,
    }: {
      data: UnstageCartonInput;
      idempotencyKey?: string;
    }) => fgWarehouseApi.unstageCarton(data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fg-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['cartons'] });
      queryClient.invalidateQueries({ queryKey: ['carton-movements'] });
      queryClient.invalidateQueries({ queryKey: ['fg-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['fg-warehouses'] });
    },
  });
}

export function useCartonMovements(params?: {
  cartonId?: string;
  movementType?: string;
  limit?: number;
}) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['carton-movements', params],
    queryFn: () => fgWarehouseApi.getMovements(params),
    enabled: isAuthenticated,
  });
}

export function useCartonHistory(cartonId: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['carton-history', cartonId],
    queryFn: () => fgWarehouseApi.getCartonHistory(cartonId),
    enabled: isAuthenticated && !!cartonId,
  });
}

export function useFgInventory(params?: {
  warehouseId?: string;
  binId?: string;
  styleId?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['fg-inventory', params],
    queryFn: () => fgWarehouseApi.getFgInventory(params),
    enabled: isAuthenticated,
  });
}

export function useFgReconciliation(styleId?: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['fg-reconciliation', styleId],
    queryFn: () => fgWarehouseApi.getFgReconciliation(styleId),
    enabled: isAuthenticated,
  });
}

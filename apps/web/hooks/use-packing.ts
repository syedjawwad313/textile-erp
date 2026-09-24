import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { packingApi } from '../lib/api/client';
import { useAuth } from '../lib/auth/auth-context';
import { PackCartonDto, CreatePackingListDto } from '../lib/api/types';

export function useCartons(params?: {
  status?: string;
  productionOrderId?: string;
  buyerPoId?: string;
  packingListId?: string;
  packingMode?: string;
  search?: string;
}) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['cartons', params],
    queryFn: () => packingApi.getCartons(params),
    enabled: isAuthenticated,
  });
}

export function useCarton(id: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['carton', id],
    queryFn: () => packingApi.getCarton(id),
    enabled: isAuthenticated && !!id,
  });
}

export function usePackCarton() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: PackCartonDto; idempotencyKey?: string }) =>
      packingApi.packCarton(data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cartons'] });
      queryClient.invalidateQueries({ queryKey: ['packing-lists'] });
    },
  });
}

export function useCancelCarton() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      packingApi.cancelCarton(id, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cartons'] });
      queryClient.invalidateQueries({ queryKey: ['carton', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['packing-lists'] });
    },
  });
}

export function useSsccPreview(params?: { companyPrefix?: string; serialNumber?: string }) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['sscc-preview', params],
    queryFn: () => packingApi.getSsccPreview(params),
    enabled: isAuthenticated,
  });
}

export function usePackingLists(params?: {
  status?: string;
  buyerId?: string;
  buyerPoId?: string;
  productionOrderId?: string;
}) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['packing-lists', params],
    queryFn: () => packingApi.getPackingLists(params),
    enabled: isAuthenticated,
  });
}

export function usePackingList(id: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['packing-list', id],
    queryFn: () => packingApi.getPackingList(id),
    enabled: isAuthenticated && !!id,
  });
}

export function useCreatePackingList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: CreatePackingListDto; idempotencyKey?: string }) =>
      packingApi.createPackingList(data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packing-lists'] });
    },
  });
}

export function useFinalizePackingList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, idempotencyKey }: { id: string; idempotencyKey?: string }) =>
      packingApi.finalizePackingList(id, idempotencyKey),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['packing-lists'] });
      queryClient.invalidateQueries({ queryKey: ['packing-list', variables.id] });
    },
  });
}

export function useAddCartonsToList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cartonIds }: { id: string; cartonIds: string[] }) =>
      packingApi.addCartonsToList(id, cartonIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['packing-lists'] });
      queryClient.invalidateQueries({ queryKey: ['packing-list', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['cartons'] });
    },
  });
}

export function useRemoveCartonFromList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cartonId }: { id: string; cartonId: string }) =>
      packingApi.removeCartonFromList(id, cartonId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['packing-lists'] });
      queryClient.invalidateQueries({ queryKey: ['packing-list', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['cartons'] });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { grnApi } from '../lib/api/client';
import { useAuth } from '../lib/auth/auth-context';
import { CreateGrnDto, GoodsReceiptNote } from '../lib/api/types';

export function useGrns(params?: { vpoId?: string; supplierId?: string; status?: string }) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['grns', params],
    queryFn: () => grnApi.getGrns(params),
    enabled: isAuthenticated,
  });
}

export function useGrn(id: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['grn', id],
    queryFn: () => grnApi.getGrn(id),
    enabled: isAuthenticated && !!id,
  });
}

export function useCreateGrn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: CreateGrnDto; idempotencyKey: string }) =>
      grnApi.createGrn(data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grns'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
    },
  });
}

export function usePostGrn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, idempotencyKey }: { id: string; idempotencyKey: string }) =>
      grnApi.postGrn(id, idempotencyKey),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['grns'] });
      queryClient.invalidateQueries({ queryKey: ['grn', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      queryClient.invalidateQueries({ queryKey: ['fabric-rolls'] });
    },
  });
}

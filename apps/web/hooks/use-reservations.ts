import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationsApi } from '../lib/api/client';
import { useAuth } from '../lib/auth/auth-context';
import { CreateMaterialReservationDto, MaterialReservation } from '../lib/api/types';

export function useMaterialReservations(params?: { productionOrderId?: string; status?: string }) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['material-reservations', params],
    queryFn: () => reservationsApi.getReservations(params),
    enabled: isAuthenticated,
  });
}

export function useMaterialReservation(id: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['material-reservation', id],
    queryFn: () => reservationsApi.getReservation(id),
    enabled: isAuthenticated && !!id,
  });
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: CreateMaterialReservationDto; idempotencyKey: string }) =>
      reservationsApi.createReservation(data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['fabric-rolls'] });
    },
  });
}

export function useReleaseReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reservationsApi.releaseReservation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['fabric-rolls'] });
    },
  });
}

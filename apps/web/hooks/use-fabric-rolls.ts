import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fabricRollsApi } from '../lib/api/client';
import { useAuth } from '../lib/auth/auth-context';
import { CreateFabricRollDto, InspectFabricRollDto, RollStatus } from '../lib/api/types';

export function useFabricRolls(params?: {
  materialId?: string;
  status?: string;
  dyeLot?: string;
  shade?: string;
  search?: string;
}) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['fabric-rolls', params],
    queryFn: () => fabricRollsApi.getRolls(params),
    enabled: isAuthenticated,
  });
}

export function useFabricRoll(id: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['fabric-roll', id],
    queryFn: () => fabricRollsApi.getRoll(id),
    enabled: isAuthenticated && !!id,
  });
}

export function useCreateFabricRoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFabricRollDto) => fabricRollsApi.createRoll(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fabric-rolls'] });
    },
  });
}

export function useInspectFabricRoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: InspectFabricRollDto }) =>
      fabricRollsApi.inspectRoll(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fabric-rolls'] });
      queryClient.invalidateQueries({ queryKey: ['fabric-roll', variables.id] });
    },
  });
}

export function useUpdateRollStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: RollStatus; notes?: string }) =>
      fabricRollsApi.updateStatus(id, { status, notes }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fabric-rolls'] });
      queryClient.invalidateQueries({ queryKey: ['fabric-roll', variables.id] });
    },
  });
}

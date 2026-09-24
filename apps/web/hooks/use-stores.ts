import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storesApi } from '../lib/api/client';
import { useAuth } from '../lib/auth/auth-context';
import {
  CreateMaterialRequisitionDto,
  CreateMaterialIssueDto,
  CreateMaterialReturnDto,
  LinkCuttingRecordRollsDto,
} from '../lib/api/types';

// Requisitions
export function useMaterialRequisitions(params?: { productionOrderId?: string; departmentId?: string; status?: string }) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['material-requisitions', params],
    queryFn: () => storesApi.getRequisitions(params),
    enabled: isAuthenticated,
  });
}

export function useCreateRequisition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMaterialRequisitionDto) => storesApi.createRequisition(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-requisitions'] });
    },
  });
}

export function useApproveRequisition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storesApi.approveRequisition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-requisitions'] });
    },
  });
}

// Issues
export function useMaterialIssues(params?: { requisitionId?: string; productionOrderId?: string; status?: string }) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['material-issues', params],
    queryFn: () => storesApi.getIssues(params),
    enabled: isAuthenticated,
  });
}

export function useCreateIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: CreateMaterialIssueDto; idempotencyKey: string }) =>
      storesApi.createIssue(data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-issues'] });
    },
  });
}

export function usePostIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, idempotencyKey }: { id: string; idempotencyKey: string }) =>
      storesApi.postIssue(id, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-issues'] });
      queryClient.invalidateQueries({ queryKey: ['material-requisitions'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['fabric-rolls'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
    },
  });
}

// Returns
export function useMaterialReturns(params?: { issueNoteId?: string; status?: string }) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['material-returns', params],
    queryFn: () => storesApi.getReturns(params),
    enabled: isAuthenticated,
  });
}

export function useCreateReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: CreateMaterialReturnDto; idempotencyKey: string }) =>
      storesApi.createReturn(data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-returns'] });
    },
  });
}

export function usePostReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, idempotencyKey }: { id: string; idempotencyKey: string }) =>
      storesApi.postReturn(id, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-returns'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['fabric-rolls'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
    },
  });
}

// Cutting Linkage
export function useCuttingRecordRolls(cuttingRecordId: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['cutting-record-rolls', cuttingRecordId],
    queryFn: () => storesApi.getCuttingRecordRolls(cuttingRecordId),
    enabled: isAuthenticated && !!cuttingRecordId,
  });
}

export function useLinkCuttingRecordRolls() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cuttingRecordId, data }: { cuttingRecordId: string; data: LinkCuttingRecordRollsDto }) =>
      storesApi.linkCuttingRecordRolls(cuttingRecordId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cutting-record-rolls', variables.cuttingRecordId] });
      queryClient.invalidateQueries({ queryKey: ['fabric-rolls'] });
    },
  });
}

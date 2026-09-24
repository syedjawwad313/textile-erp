import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shippingApi } from '../lib/api/client';
import { useAuth } from '../lib/auth/auth-context';
import {
  CreateShipmentInput,
  CreateCommercialInvoiceInput,
  CreateGatePassInput,
} from '../lib/api/types';

export function useShipments(params?: {
  buyerId?: string;
  buyerPoId?: string;
  status?: string;
  search?: string;
  limit?: number;
}) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['shipments', params],
    queryFn: () => shippingApi.getShipments(params),
    enabled: isAuthenticated,
  });
}

export function useShipment(id: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['shipment', id],
    queryFn: () => shippingApi.getShipmentById(id),
    enabled: isAuthenticated && Boolean(id),
  });
}

export function useCreateShipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: CreateShipmentInput; idempotencyKey?: string }) =>
      shippingApi.createShipment(data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['cartons'] });
      queryClient.invalidateQueries({ queryKey: ['fg-inventory'] });
    },
  });
}

export function useAssignCartons() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { cartonIds?: string[]; packingListIds?: string[] } }) =>
      shippingApi.assignCartons(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['shipment', id] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['cartons'] });
    },
  });
}

export function useCancelShipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      shippingApi.cancelShipment(id, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['shipment', id] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['cartons'] });
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
    },
  });
}

export function useInvoices(params?: {
  shipmentId?: string;
  buyerId?: string;
  status?: string;
  limit?: number;
}) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['invoices', params],
    queryFn: () => shippingApi.getInvoices(params),
    enabled: isAuthenticated,
  });
}

export function useInvoice(id: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: () => shippingApi.getInvoiceById(id),
    enabled: isAuthenticated && Boolean(id),
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: CreateCommercialInvoiceInput; idempotencyKey?: string }) =>
      shippingApi.createInvoice(data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
    },
  });
}

export function useIssueInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => shippingApi.issueInvoice(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useSettleInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { paymentReference: string; paymentDate: string; paidAmount: number; notes?: string };
    }) => shippingApi.settleInvoice(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useGatePasses(params?: {
  shipmentId?: string;
  status?: string;
  limit?: number;
}) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['gate-passes', params],
    queryFn: () => shippingApi.getGatePasses(params),
    enabled: isAuthenticated,
  });
}

export function useGatePass(id: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['gate-pass', id],
    queryFn: () => shippingApi.getGatePassById(id),
    enabled: isAuthenticated && Boolean(id),
  });
}

export function useCreateGatePass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: CreateGatePassInput; idempotencyKey?: string }) =>
      shippingApi.createGatePass(data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
    },
  });
}

export function useApproveGatePass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => shippingApi.approveGatePass(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['gate-pass', id] });
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
    },
  });
}

export function useCancelGatePass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      shippingApi.cancelGatePass(id, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['gate-pass', id] });
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
    },
  });
}

export function useDispatchGatePass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, idempotencyKey }: { id: string; idempotencyKey?: string }) =>
      shippingApi.dispatchGatePass(id, idempotencyKey),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['gate-pass', id] });
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['cartons'] });
      queryClient.invalidateQueries({ queryKey: ['fg-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['fg-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}

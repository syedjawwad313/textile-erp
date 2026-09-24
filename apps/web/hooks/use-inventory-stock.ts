import { useQuery } from '@tanstack/react-query';
import { inventoryStockApi } from '../lib/api/client';
import { useAuth } from '../lib/auth/auth-context';

export function useInventoryItems(params?: { materialId?: string; category?: string }) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['inventory-items', params],
    queryFn: () => inventoryStockApi.getItems(params),
    enabled: isAuthenticated,
  });
}

export function useInventoryTransactions(params?: { materialId?: string; type?: string; binId?: string; limit?: number }) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['inventory-transactions', params],
    queryFn: () => inventoryStockApi.getTransactions(params),
    enabled: isAuthenticated,
  });
}

export function useInventorySummary() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['inventory-summary'],
    queryFn: () => inventoryStockApi.getSummary(),
    enabled: isAuthenticated,
  });
}

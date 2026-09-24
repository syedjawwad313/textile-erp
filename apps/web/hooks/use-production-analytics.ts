"use client";

import { useQuery } from "@tanstack/react-query";
import { productionAnalyticsApi } from "../lib/api/client";
import {
  AnalyticsFilterParams,
  AnalyticsOverview,
  OrderProgressMetric,
  LinePerformanceMetric,
  DowntimeAnalytics,
  QualityAnalytics,
  WipBottleneckMetric,
} from "../lib/api/types";

export function useAnalyticsOverview(params?: AnalyticsFilterParams, refetchInterval = 10000) {
  return useQuery<AnalyticsOverview>({
    queryKey: ["analytics-overview", params],
    queryFn: async () => {
      return (await productionAnalyticsApi.getOverview(params)) as AnalyticsOverview;
    },
    refetchInterval,
  });
}

export function useOrderProgressAnalytics(params?: AnalyticsFilterParams, refetchInterval = 15000) {
  return useQuery<OrderProgressMetric[]>({
    queryKey: ["analytics-orders", params],
    queryFn: async () => {
      return (await productionAnalyticsApi.getOrders(params)) as OrderProgressMetric[];
    },
    refetchInterval,
  });
}

export function useLinePerformanceAnalytics(params?: AnalyticsFilterParams, refetchInterval = 10000) {
  return useQuery<LinePerformanceMetric[]>({
    queryKey: ["analytics-lines", params],
    queryFn: async () => {
      return (await productionAnalyticsApi.getLines(params)) as LinePerformanceMetric[];
    },
    refetchInterval,
  });
}

export function useDowntimeAnalytics(params?: AnalyticsFilterParams, refetchInterval = 15000) {
  return useQuery<DowntimeAnalytics>({
    queryKey: ["analytics-downtime", params],
    queryFn: async () => {
      return (await productionAnalyticsApi.getDowntime(params)) as DowntimeAnalytics;
    },
    refetchInterval,
  });
}

export function useQualityAnalytics(params?: AnalyticsFilterParams, refetchInterval = 15000) {
  return useQuery<QualityAnalytics>({
    queryKey: ["analytics-quality", params],
    queryFn: async () => {
      return (await productionAnalyticsApi.getQuality(params)) as QualityAnalytics;
    },
    refetchInterval,
  });
}

export function useWipBottlenecks(params?: AnalyticsFilterParams, refetchInterval = 15000) {
  return useQuery<WipBottleneckMetric[]>({
    queryKey: ["analytics-wip", params],
    queryFn: async () => {
      return (await productionAnalyticsApi.getWip(params)) as WipBottleneckMetric[];
    },
    refetchInterval,
  });
}

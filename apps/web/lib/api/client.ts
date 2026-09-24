import { tokenStorage } from "../auth/token-storage";
import {
  ApiErrorResponse,
  QualityInspection,
  CreateQualityInspectionInput,
  ApplyQualityHoldInput,
  ReleaseQualityHoldInput,
  QualityDefectStats,
  BundleQualityHistory,
  Bundle,
  ProductionOutput,
  ProductionDefect,
  QualityHold,
  RecordProductionOutputInput,
  CreateProductionDefectInput,
  CreateQualityHoldInput,
  ReleaseQualityHoldPayload,
  AnalyticsFilterParams,
  AnalyticsOverview,
  OrderProgressMetric,
  LinePerformanceMetric,
  DowntimeAnalytics,
  QualityAnalytics,
  WipBottleneckMetric,
  Shift,
  CreateShiftInput,
  UpdateShiftInput,
  ShiftAssignment,
  CreateShiftAssignmentInput,
  ProductionSchedule,
  CreateProductionScheduleInput,
  UpdateProductionScheduleInput,
  QueryScheduleParams,
  QueryCapacityParams,
  LineCapacityMetric,
  ScheduleConflictReport,
  DefectCatalog,
  CreateDefectCatalogInput,
  UpdateDefectCatalogInput,
  InspectionPlan,
  CreateInspectionPlanInput,
  UpdateInspectionPlanInput,
  AqlSamplingPlan,
  AqlAudit,
  CreateAqlAuditInput,
  NonConformanceReport,
  CreateNcrInput,
  UpdateNcrStatusInput,
  CapaAction,
  CreateCapaActionInput,
  UpdateCapaActionInput,
  StockItem,
  InventoryTransaction,
  InventorySummary,
  GoodsReceiptNote,
  GrnLine,
  FabricRoll,
  FabricRollInspection,
  MaterialReservation,
  MaterialRequisition,
  MaterialIssueNote,
  MaterialReturnNote,
  CuttingRecordRoll,
  Carton,
  PackingList,
  PackCartonDto,
  CreatePackingListDto,
  Warehouse,
  Bin,
  UpdateWarehouseTypeInput,
  UpdateBinTypeInput,
  PutawayCartonInput,
  RelocateCartonInput,
  StageCartonInput,
  UnstageCartonInput,
  CartonMovement,
  FgInventoryResponse,
  FgReconciliationReport,
  Shipment,
  CommercialInvoice,
  OutboundGatePass,
  CreateShipmentInput,
  CreateCommercialInvoiceInput,
  CreateGatePassInput,
  EntitySchemaDefinition,
  ParseFileResponse,
  ImportPreviewResponse,
  CommitImportRequest,
  ImportCommitResponse,
  DataImportLog,
  ImportEntity,
} from "./types";

export class ApiError extends Error {
  statusCode: number;
  data?: any;

  constructor(statusCode: number, message: string, data?: any) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.data = data;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
}

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

async function refreshToken(): Promise<string | null> {
  const refresh = tokenStorage.getRefreshToken();
  if (!refresh) return null;

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken: refresh }),
    });

    if (!res.ok) {
      tokenStorage.clearAll();
      return null;
    }

    const data = await res.json();
    if (data.accessToken) {
      tokenStorage.setAccessToken(data.accessToken);
      if (data.refreshToken) {
        tokenStorage.setRefreshToken(data.refreshToken);
      }
      return data.accessToken;
    }
    return null;
  } catch {
    tokenStorage.clearAll();
    return null;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, skipAuth = false, headers = {}, ...customConfig } = options;

  let normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (normalizedEndpoint.startsWith("/warehouses") || normalizedEndpoint.startsWith("/inventory")) {
    normalizedEndpoint = `/api/v1${normalizedEndpoint}`;
  }

  let url = endpoint.startsWith("http")
    ? endpoint
    : `${BASE_URL}${normalizedEndpoint}`;

  if (params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query.append(key, String(value));
      }
    });
    const queryString = query.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const isFormData = typeof FormData !== "undefined" && customConfig.body instanceof FormData;
  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(headers as Record<string, string>),
  };
  if (isFormData) {
    delete requestHeaders["Content-Type"];
  }

  const tenantId = tokenStorage.getTenantId();
  if (tenantId && !requestHeaders["x-tenant-id"]) {
    requestHeaders["x-tenant-id"] = tenantId;
  }

  if (!skipAuth) {
    const token = tokenStorage.getAccessToken();
    if (token) {
      requestHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  const config: RequestInit = {
    headers: requestHeaders,
    ...customConfig,
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (err: any) {
    throw new ApiError(
      0,
      err?.message || "Network error. Failed to connect to server."
    );
  }

  // Handle 401 Unauthorized with token refresh mechanism
  if (response.status === 401 && !skipAuth) {
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          requestHeaders["Authorization"] = `Bearer ${newToken}`;
          return fetch(url, { ...config, headers: requestHeaders }).then((r) =>
            handleResponse<T>(r)
          );
        })
        .catch((err) => {
          throw err;
        });
    }

    isRefreshing = true;

    try {
      const newToken = await refreshToken();
      if (newToken) {
        processQueue(null, newToken);
        requestHeaders["Authorization"] = `Bearer ${newToken}`;
        const retryRes = await fetch(url, {
          ...config,
          headers: requestHeaders,
        });
        return await handleResponse<T>(retryRes);
      } else {
        processQueue(new ApiError(401, "Session expired. Please log in again."));
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
        throw new ApiError(401, "Session expired. Please log in again.");
      }
    } catch (err) {
      processQueue(err);
      throw err;
    } finally {
      isRefreshing = false;
    }
  }

  return handleResponse<T>(response);
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");

  let data: any = null;
  if (isJson) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      data = await response.text();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}`;
    if (data) {
      if (typeof data.message === "string") {
        errorMessage = data.message;
      } else if (Array.isArray(data.message)) {
        errorMessage = data.message.join(", ");
      } else if (typeof data.error === "string") {
        errorMessage = data.error;
      }
    }

    if (response.status === 403) {
      errorMessage =
        errorMessage || "Access Denied: You lack required RBAC permissions.";
    } else if (response.status === 404) {
      errorMessage = errorMessage || "The requested resource was not found.";
    } else if (response.status === 409) {
      errorMessage =
        errorMessage || "A conflict occurred with the existing record.";
    } else if (response.status >= 500) {
      errorMessage =
        errorMessage || "Internal server error. Please try again later.";
    }

    throw new ApiError(response.status, errorMessage, data);
  }

  return data as T;
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions): Promise<T> =>
    request<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(
    endpoint: string,
    body?: any,
    options?: RequestOptions
  ): Promise<T> =>
    request<T>(endpoint, {
      ...options,
      method: "POST",
      body: (typeof FormData !== "undefined" && body instanceof FormData) ? body : body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(
    endpoint: string,
    body?: any,
    options?: RequestOptions
  ): Promise<T> =>
    request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(
    endpoint: string,
    body?: any,
    options?: RequestOptions
  ): Promise<T> =>
    request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestOptions): Promise<T> =>
    request<T>(endpoint, { ...options, method: "DELETE" }),
};

export const productionApi = {
  getOrders: () => api.get<any[]>("/production/orders"),
  getOrderById: (id: string) => api.get<any>(`/production/orders/${id}`),
  getOrderPipeline: (id: string) => api.get<any>(`/production/pipeline/orders/${id}`),
  getBuyerPoPipeline: (poId: string) => api.get<any>(`/production/pipeline/buyer-po/${poId}`),
  createOrder: (input: any, idempotencyKey?: string) =>
    api.post<any>("/production/orders", input, {
      headers: idempotencyKey ? { "x-idempotency-key": idempotencyKey } : undefined,
    }),
  planOrder: (id: string, input: any, idempotencyKey?: string) =>
    api.post<{ order: any; plan: any }>(
      `/production/orders/${id}/plan`,
      input,
      {
        headers: idempotencyKey ? { "x-idempotency-key": idempotencyKey } : undefined,
      }
    ),
  getPlans: (lineId?: string, orderId?: string) => {
    const params = new URLSearchParams();
    if (lineId) params.append("lineId", lineId);
    if (orderId) params.append("orderId", orderId);
    const query = params.toString() ? `?${params.toString()}` : "";
    return api.get<any[]>(`/production/plans${query}`);
  },
  createCuttingRecord: (input: any, idempotencyKey?: string) =>
    api.post<any>("/cutting/records", input, {
      headers: idempotencyKey ? { "x-idempotency-key": idempotencyKey } : undefined,
    }),
  getCuttingRecords: (productionOrderId?: string) => {
    const query = productionOrderId ? `?productionOrderId=${encodeURIComponent(productionOrderId)}` : "";
    return api.get<any[]>(`/cutting/records${query}`);
  },
  transitionStatus: (id: string, status: string) =>
    api.patch<any>(`/production/orders/${id}/status`, { status }),

  // Phase 5.6: MES Production Completion, Defects & Quality Hold
  recordOutput: (input: RecordProductionOutputInput, idempotencyKey?: string) =>
    api.post<ProductionOutput>("/production/output", input, {
      headers: idempotencyKey ? { "x-idempotency-key": idempotencyKey } : undefined,
    }),
  getOutputs: (params?: { productionOrderId?: string; bundleId?: string; operationId?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.productionOrderId) searchParams.append("productionOrderId", params.productionOrderId);
    if (params?.bundleId) searchParams.append("bundleId", params.bundleId);
    if (params?.operationId) searchParams.append("operationId", params.operationId);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return api.get<ProductionOutput[]>(`/production/output${query}`);
  },
  createDefect: (input: CreateProductionDefectInput, idempotencyKey?: string) =>
    api.post<ProductionDefect>("/production/defects", input, {
      headers: idempotencyKey ? { "x-idempotency-key": idempotencyKey } : undefined,
    }),
  getDefects: (params?: { productionOrderId?: string; bundleId?: string; operationId?: string; status?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.productionOrderId) searchParams.append("productionOrderId", params.productionOrderId);
    if (params?.bundleId) searchParams.append("bundleId", params.bundleId);
    if (params?.operationId) searchParams.append("operationId", params.operationId);
    if (params?.status) searchParams.append("status", params.status);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return api.get<ProductionDefect[]>(`/production/defects${query}`);
  },
  createQualityHold: (input: CreateQualityHoldInput, idempotencyKey?: string) =>
    api.post<QualityHold>("/production/quality-holds", input, {
      headers: idempotencyKey ? { "x-idempotency-key": idempotencyKey } : undefined,
    }),
  getQualityHolds: (params?: { productionOrderId?: string; bundleId?: string; status?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.productionOrderId) searchParams.append("productionOrderId", params.productionOrderId);
    if (params?.bundleId) searchParams.append("bundleId", params.bundleId);
    if (params?.status) searchParams.append("status", params.status);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return api.get<QualityHold[]>(`/production/quality-holds${query}`);
  },
  releaseQualityHold: (id: string, input: ReleaseQualityHoldPayload, idempotencyKey?: string) =>
    api.post<QualityHold>(`/production/quality-holds/${id}/release`, input, {
      headers: idempotencyKey ? { "x-idempotency-key": idempotencyKey } : undefined,
    }),
};

export const bundlesApi = {
  generate: (input: any, idempotencyKey?: string) =>
    api.post<any[]>("/bundles/generate", input, {
      headers: idempotencyKey ? { "x-idempotency-key": idempotencyKey } : undefined,
    }),
  getAll: (params?: { cuttingRecordId?: string; productionOrderId?: string; barcode?: string; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.cuttingRecordId) searchParams.append("cuttingRecordId", params.cuttingRecordId);
    if (params?.productionOrderId) searchParams.append("productionOrderId", params.productionOrderId);
    if (params?.barcode) searchParams.append("barcode", params.barcode);
    if (params?.status) searchParams.append("status", params.status);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return api.get<any[]>(`/bundles${query}`);
  },
  getById: (id: string) => api.get<any>(`/bundles/${id}`),
  scan: (input: any, idempotencyKey?: string) =>
    api.post<any>("/bundles/scan", input, {
      headers: idempotencyKey ? { "x-idempotency-key": idempotencyKey } : undefined,
    }),
  getScans: (params?: { bundleId?: string; operationId?: string; employeeId?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.bundleId) searchParams.append("bundleId", params.bundleId);
    if (params?.operationId) searchParams.append("operationId", params.operationId);
    if (params?.employeeId) searchParams.append("employeeId", params.employeeId);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return api.get<any[]>(`/bundles/scans${query}`);
  },
};

export const downtimeApi = {
  create: (input: any, idempotencyKey?: string) =>
    api.post<any>("/downtime/events", input, {
      headers: idempotencyKey ? { "x-idempotency-key": idempotencyKey } : undefined,
    }),
  resolve: (id: string, input: any) =>
    api.post<any>(`/downtime/events/${id}/resolve`, input),
  getAll: (params?: { productionLineId?: string; machineId?: string; status?: string; from?: string; to?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.productionLineId) searchParams.append("productionLineId", params.productionLineId);
    if (params?.machineId) searchParams.append("machineId", params.machineId);
    if (params?.status) searchParams.append("status", params.status);
    if (params?.from) searchParams.append("from", params.from);
    if (params?.to) searchParams.append("to", params.to);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return api.get<any[]>(`/downtime/events${query}`);
  },
  getById: (id: string) => api.get<any>(`/downtime/events/${id}`),
};

export const qualityApi = {
  createInspection: (input: CreateQualityInspectionInput, idempotencyKey?: string) =>
    api.post<QualityInspection>("/quality/inspections", input, {
      headers: idempotencyKey ? { "x-idempotency-key": idempotencyKey } : undefined,
    }),
  getInspections: (params?: {
    bundleId?: string;
    productionOrderId?: string;
    operationId?: string;
    inspectorId?: string;
    result?: string;
    from?: string;
    to?: string;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.bundleId) searchParams.append("bundleId", params.bundleId);
    if (params?.productionOrderId) searchParams.append("productionOrderId", params.productionOrderId);
    if (params?.operationId) searchParams.append("operationId", params.operationId);
    if (params?.inspectorId) searchParams.append("inspectorId", params.inspectorId);
    if (params?.result) searchParams.append("result", params.result);
    if (params?.from) searchParams.append("from", params.from);
    if (params?.to) searchParams.append("to", params.to);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return api.get<QualityInspection[]>(`/quality/inspections${query}`);
  },
  getInspectionById: (id: string) => api.get<QualityInspection>(`/quality/inspections/${id}`),
  applyHold: (bundleId: string, input: ApplyQualityHoldInput, idempotencyKey?: string) =>
    api.post<Bundle>(`/quality/bundles/${bundleId}/hold`, input, {
      headers: idempotencyKey ? { "x-idempotency-key": idempotencyKey } : undefined,
    }),
  releaseHold: (bundleId: string, input: ReleaseQualityHoldInput, idempotencyKey?: string) =>
    api.post<Bundle>(`/quality/bundles/${bundleId}/release-hold`, input, {
      headers: idempotencyKey ? { "x-idempotency-key": idempotencyKey } : undefined,
    }),
  getDefectStats: (productionOrderId?: string) => {
    const query = productionOrderId ? `?productionOrderId=${productionOrderId}` : "";
    return api.get<QualityDefectStats>(`/quality/stats/defects${query}`);
  },
  getBundleHistory: (bundleId: string) => api.get<BundleQualityHistory>(`/quality/bundles/${bundleId}/history`),
};

function buildAnalyticsQuery(params?: AnalyticsFilterParams): string {
  if (!params) return "";
  const searchParams = new URLSearchParams();
  if (params.productionOrderId) searchParams.append("productionOrderId", params.productionOrderId);
  if (params.productionLineId) searchParams.append("productionLineId", params.productionLineId);
  if (params.factoryUnitId) searchParams.append("factoryUnitId", params.factoryUnitId);
  if (params.from) searchParams.append("from", params.from);
  if (params.to) searchParams.append("to", params.to);
  if (params.status) searchParams.append("status", params.status);
  const q = searchParams.toString();
  return q ? `?${q}` : "";
}

export const productionAnalyticsApi = {
  getOverview: (params?: AnalyticsFilterParams) =>
    api.get<AnalyticsOverview>(`/production/analytics/overview${buildAnalyticsQuery(params)}`),
  getOrders: (params?: AnalyticsFilterParams) =>
    api.get<OrderProgressMetric[]>(`/production/analytics/orders${buildAnalyticsQuery(params)}`),
  getLines: (params?: AnalyticsFilterParams) =>
    api.get<LinePerformanceMetric[]>(`/production/analytics/lines${buildAnalyticsQuery(params)}`),
  getDowntime: (params?: AnalyticsFilterParams) =>
    api.get<DowntimeAnalytics>(`/production/analytics/downtime${buildAnalyticsQuery(params)}`),
  getQuality: (params?: AnalyticsFilterParams) =>
    api.get<QualityAnalytics>(`/production/analytics/quality${buildAnalyticsQuery(params)}`),
  getWip: (params?: AnalyticsFilterParams) =>
    api.get<WipBottleneckMetric[]>(`/production/analytics/wip${buildAnalyticsQuery(params)}`),
};

// -----------------------------------------------------------------------------
// MES Shift, Capacity & Scheduling API (Phase 5.8)
// -----------------------------------------------------------------------------
export const shiftsApi = {
  getAll: (params?: { factoryUnitId?: string; active?: boolean }) =>
    api.get<Shift[]>('/production/shifts', { params }),
  getById: (id: string) =>
    api.get<Shift>(`/production/shifts/${id}`),
  create: (data: CreateShiftInput) =>
    api.post<Shift>('/production/shifts', data),
  update: (id: string, data: UpdateShiftInput) =>
    api.patch<Shift>(`/production/shifts/${id}`, data),
  getAssignments: (shiftId: string, params?: { workDate?: string; productionLineId?: string; employeeId?: string }) =>
    api.get<ShiftAssignment[]>(`/production/shifts/${shiftId}/assignments`, { params }),
  createAssignment: (shiftId: string, data: CreateShiftAssignmentInput) =>
    api.post<ShiftAssignment>(`/production/shifts/${shiftId}/assignments`, data),
  deleteAssignment: (shiftId: string, assignmentId: string) =>
    api.delete<{ success: boolean; deletedId: string }>(`/production/shifts/${shiftId}/assignments/${assignmentId}`),
};

export const productionSchedulingApi = {
  getAll: (params?: QueryScheduleParams) =>
    api.get<ProductionSchedule[]>('/production/schedules', { params: params as any }),
  getById: (id: string) =>
    api.get<ProductionSchedule>(`/production/schedules/${id}`),
  create: (data: CreateProductionScheduleInput, idempotencyKey?: string) =>
    api.post<ProductionSchedule>('/production/schedules', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),
  update: (id: string, data: UpdateProductionScheduleInput) =>
    api.patch<ProductionSchedule>(`/production/schedules/${id}`, data),
  getCapacity: (params?: QueryCapacityParams) =>
    api.get<LineCapacityMetric[]>('/production/capacity', { params: params as any }),
  getConflicts: (params?: { productionLineId?: string; from?: string; to?: string }) =>
    api.get<ScheduleConflictReport>('/production/schedule-conflicts', { params }),
};

// -----------------------------------------------------------------------------
// Quality Management API (Phase 6)
// -----------------------------------------------------------------------------
export const defectCatalogApi = {
  getAll: (params?: { category?: string; severity?: string; active?: boolean; search?: string }) =>
    api.get<DefectCatalog[]>('/quality/catalog', { params }),
  getById: (id: string) =>
    api.get<DefectCatalog>(`/quality/catalog/${id}`),
  create: (data: CreateDefectCatalogInput) =>
    api.post<DefectCatalog>('/quality/catalog', data),
  update: (id: string, data: UpdateDefectCatalogInput) =>
    api.patch<DefectCatalog>(`/quality/catalog/${id}`, data),
};

export const inspectionPlansApi = {
  getAll: (params?: { styleId?: string; stage?: string; active?: boolean; search?: string }) =>
    api.get<InspectionPlan[]>('/quality/plans', { params }),
  getById: (id: string) =>
    api.get<InspectionPlan>(`/quality/plans/${id}`),
  create: (data: CreateInspectionPlanInput) =>
    api.post<InspectionPlan>('/quality/plans', data),
  update: (id: string, data: UpdateInspectionPlanInput) =>
    api.patch<InspectionPlan>(`/quality/plans/${id}`, data),
};

export const aqlApi = {
  calculate: (params: { lotSize: number; inspectionLevel?: string; aqlMajor?: number; aqlMinor?: number }) =>
    api.get<AqlSamplingPlan>('/quality/aql/calculate', { params }),
  recordAudit: (data: CreateAqlAuditInput, idempotencyKey?: string) =>
    api.post<AqlAudit>('/quality/aql/audits', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),
  getAll: (params?: { productionOrderId?: string; status?: string; stage?: string; from?: string; to?: string; limit?: number }) =>
    api.get<AqlAudit[]>('/quality/aql/audits', { params }),
  getById: (id: string) =>
    api.get<AqlAudit>(`/quality/aql/audits/${id}`),
};

export const ncrApi = {
  getAll: (params?: { status?: string; severity?: string; source?: string; productionOrderId?: string; search?: string; limit?: number }) =>
    api.get<NonConformanceReport[]>('/quality/ncr', { params }),
  getById: (id: string) =>
    api.get<NonConformanceReport>(`/quality/ncr/${id}`),
  create: (data: CreateNcrInput, idempotencyKey?: string) =>
    api.post<NonConformanceReport>('/quality/ncr', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),
  updateStatus: (id: string, data: UpdateNcrStatusInput) =>
    api.patch<NonConformanceReport>(`/quality/ncr/${id}/status`, data),
  addCapaAction: (id: string, data: CreateCapaActionInput) =>
    api.post<CapaAction>(`/quality/ncr/${id}/capa`, data),
  updateCapaAction: (id: string, capaId: string, data: UpdateCapaActionInput) =>
    api.patch<CapaAction>(`/quality/ncr/${id}/capa/${capaId}`, data),
};

// -----------------------------------------------------------------------------
// Material Management, Fabric Rolls & Stores API (Phase 7)
// -----------------------------------------------------------------------------
export const inventoryStockApi = {
  getItems: (params?: { materialId?: string; category?: string }) =>
    api.get<StockItem[]>('/inventory/items', { params }),
  getTransactions: (params?: { materialId?: string; type?: string; binId?: string; limit?: number }) =>
    api.get<InventoryTransaction[]>('/inventory/transactions', { params }),
  getSummary: () =>
    api.get<InventorySummary>('/inventory/summary'),
};

export const grnApi = {
  getAll: (params?: { status?: string; vpoId?: string }) =>
    api.get<GoodsReceiptNote[]>('/inventory/grn', { params }),
  getGrns: (params?: { status?: string; vpoId?: string }) =>
    api.get<GoodsReceiptNote[]>('/inventory/grn', { params }),
  getById: (id: string) =>
    api.get<GoodsReceiptNote>(`/inventory/grn/${id}`),
  getGrn: (id: string) =>
    api.get<GoodsReceiptNote>(`/inventory/grn/${id}`),
  create: (data: any, idempotencyKey?: string) =>
    api.post<GoodsReceiptNote>('/inventory/grn', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),
  createGrn: (data: any, idempotencyKey?: string) =>
    api.post<GoodsReceiptNote>('/inventory/grn', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),
  postGrn: (id: string, idempotencyKey?: string) =>
    api.patch<GoodsReceiptNote>(`/inventory/grn/${id}/status`, { status: 'RECEIVED' }, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),
  updateStatus: (id: string, data: { status: string; rejectionReason?: string }) =>
    api.patch<GoodsReceiptNote>(`/inventory/grn/${id}/status`, data),
};

export const fabricRollsApi = {
  getAll: (params?: { materialId?: string; lotNumber?: string; shade?: string; status?: string; warehouseId?: string }) =>
    api.get<FabricRoll[]>('/inventory/rolls', { params }),
  getRolls: (params?: { materialId?: string; lotNumber?: string; shade?: string; status?: string; warehouseId?: string; dyeLot?: string }) =>
    api.get<FabricRoll[]>('/inventory/rolls', { params }),
  getById: (id: string) =>
    api.get<FabricRoll>(`/inventory/rolls/${id}`),
  getRoll: (id: string) =>
    api.get<FabricRoll>(`/inventory/rolls/${id}`),
  create: (data: any) =>
    api.post<FabricRoll>('/inventory/rolls', data),
  createRoll: (data: any) =>
    api.post<FabricRoll>('/inventory/rolls', data),
  recordInspection: (id: string, data: any) =>
    api.post<{ inspection: FabricRollInspection; roll: FabricRoll }>(`/inventory/rolls/${id}/inspection`, data),
  inspectRoll: (id: string, data: any) =>
    api.post<{ inspection: FabricRollInspection; roll: FabricRoll }>(`/inventory/rolls/${id}/inspection`, data),
  updateStatus: (id: string, data: { status: string; notes?: string }) =>
    api.patch<FabricRoll>(`/inventory/rolls/${id}/status`, data),
};

export const reservationsApi = {
  getAll: (params?: { productionOrderId?: string; status?: string }) =>
    api.get<MaterialReservation[]>('/inventory/reservations', { params }),
  getReservations: (params?: { productionOrderId?: string; status?: string }) =>
    api.get<MaterialReservation[]>('/inventory/reservations', { params }),
  getById: (id: string) =>
    api.get<MaterialReservation>(`/inventory/reservations/${id}`),
  getReservation: (id: string) =>
    api.get<MaterialReservation>(`/inventory/reservations/${id}`),
  create: (data: any, idempotencyKey?: string) =>
    api.post<MaterialReservation>('/inventory/reservations', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),
  createReservation: (data: any, idempotencyKey?: string) =>
    api.post<MaterialReservation>('/inventory/reservations', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),
  release: (id: string) =>
    api.delete<MaterialReservation>(`/inventory/reservations/${id}`),
  releaseReservation: (id: string) =>
    api.delete<MaterialReservation>(`/inventory/reservations/${id}`),
};

export const storesApi = {
  getRequisitions: (params?: { productionOrderId?: string; status?: string }) =>
    api.get<MaterialRequisition[]>('/inventory/requisitions', { params }),
  createRequisition: (data: any, idempotencyKey?: string) =>
    api.post<MaterialRequisition>('/inventory/requisitions', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),
  updateRequisitionStatus: (id: string, status: string) =>
    api.patch<MaterialRequisition>(`/inventory/requisitions/${id}/status`, { status }),
  approveRequisition: (id: string) =>
    api.patch<MaterialRequisition>(`/inventory/requisitions/${id}/status`, { status: 'APPROVED' }),
  getIssueNotes: (params?: { productionOrderId?: string }) =>
    api.get<MaterialIssueNote[]>('/inventory/issues', { params }),
  getIssues: (params?: { requisitionId?: string; productionOrderId?: string; status?: string }) =>
    api.get<MaterialIssueNote[]>('/inventory/issues', { params }),
  createIssueNote: (data: any, idempotencyKey?: string) =>
    api.post<MaterialIssueNote>('/inventory/issues', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),
  createIssue: (data: any, idempotencyKey?: string) =>
    api.post<MaterialIssueNote>('/inventory/issues', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),
  postIssue: (id: string, idempotencyKey?: string) =>
    api.patch<MaterialIssueNote>(`/inventory/issues/${id}/status`, { status: 'ISSUED' }, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),
  getReturnNotes: (params?: { productionOrderId?: string }) =>
    api.get<MaterialReturnNote[]>('/inventory/returns', { params }),
  getReturns: (params?: { issueNoteId?: string; status?: string }) =>
    api.get<MaterialReturnNote[]>('/inventory/returns', { params }),
  createReturnNote: (data: any, idempotencyKey?: string) =>
    api.post<MaterialReturnNote>('/inventory/returns', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),
  createReturn: (data: any, idempotencyKey?: string) =>
    api.post<MaterialReturnNote>('/inventory/returns', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),
  postReturn: (id: string, idempotencyKey?: string) =>
    api.patch<MaterialReturnNote>(`/inventory/returns/${id}/status`, { status: 'RETURNED' }, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),
  getCuttingRecordRolls: (cuttingRecordId: string) =>
    api.get<CuttingRecordRoll[]>(`/inventory/cutting-rolls?cuttingRecordId=${cuttingRecordId}`),
  linkCuttingRoll: (data: any) =>
    api.post<CuttingRecordRoll>('/inventory/cutting-rolls', data),
  linkCuttingRecordRolls: (cuttingRecordId: string, data: any) =>
    api.post<CuttingRecordRoll>('/inventory/cutting-rolls', { cuttingRecordId, ...data }),
};

// -----------------------------------------------------------------------------
// Phase 8.1 Finished Goods Packaging & Cartonization API
// -----------------------------------------------------------------------------
export const packingApi = {
  getCartons: (params?: {
    status?: string;
    productionOrderId?: string;
    buyerPoId?: string;
    packingListId?: string;
    packingMode?: string;
    search?: string;
  }) => api.get<Carton[]>('/packing/cartons', { params }),

  getCarton: (id: string) =>
    api.get<Carton>(`/packing/cartons/${id}`),

  packCarton: (data: PackCartonDto, idempotencyKey?: string) =>
    api.post<Carton>('/packing/cartons', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),

  cancelCarton: (id: string, reason?: string) =>
    api.patch<Carton>(`/packing/cartons/${id}/cancel`, { reason }),

  getSsccPreview: (params?: { companyPrefix?: string; serialNumber?: string }) =>
    api.get<{ sscc: string; formatted: string }>('/packing/sscc/preview', { params }),

  getPackingLists: (params?: {
    status?: string;
    buyerId?: string;
    buyerPoId?: string;
    productionOrderId?: string;
  }) => api.get<PackingList[]>('/packing/lists', { params }),

  getPackingList: (id: string) =>
    api.get<PackingList>(`/packing/lists/${id}`),

  createPackingList: (data: CreatePackingListDto, idempotencyKey?: string) =>
    api.post<PackingList>('/packing/lists', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),

  finalizePackingList: (id: string, idempotencyKey?: string) =>
    api.patch<PackingList>(`/packing/lists/${id}/finalize`, {}, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),

  addCartonsToList: (id: string, cartonIds: string[]) =>
    api.post<PackingList>(`/packing/lists/${id}/cartons`, { cartonIds }),

  removeCartonFromList: (id: string, cartonId: string) =>
    api.delete<PackingList>(`/packing/lists/${id}/cartons/${cartonId}`),
};

// -----------------------------------------------------------------------------
// Phase 8.2 Finished Goods Warehouse Control & Stock Staging API
// -----------------------------------------------------------------------------
export const fgWarehouseApi = {
  getWarehouses: () =>
    api.get<Warehouse[]>('/packing/warehouse/warehouses'),

  updateWarehouseType: (id: string, data: UpdateWarehouseTypeInput) =>
    api.patch<Warehouse>(`/packing/warehouse/warehouses/${id}/type`, data),

  updateBinType: (id: string, data: UpdateBinTypeInput) =>
    api.patch<Bin>(`/packing/warehouse/bins/${id}/type`, data),

  putawayCarton: (data: PutawayCartonInput, idempotencyKey?: string) =>
    api.post<{ carton: Carton; movement: CartonMovement }>('/packing/warehouse/putaway', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),

  relocateCarton: (data: RelocateCartonInput, idempotencyKey?: string) =>
    api.post<{ carton: Carton; movement: CartonMovement }>('/packing/warehouse/relocate', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),

  stageCarton: (data: StageCartonInput, idempotencyKey?: string) =>
    api.post<{ carton: Carton; movement: CartonMovement }>('/packing/warehouse/stage', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),

  unstageCarton: (data: UnstageCartonInput, idempotencyKey?: string) =>
    api.post<{ carton: Carton; movement: CartonMovement }>('/packing/warehouse/unstage', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),

  getMovements: (params?: { cartonId?: string; movementType?: string; limit?: number }) =>
    api.get<CartonMovement[]>('/packing/warehouse/movements', { params }),

  getCartonHistory: (cartonId: string) =>
    api.get<{ carton: Carton; movements: CartonMovement[]; totalMovements: number }>(
      `/packing/warehouse/cartons/${cartonId}/movements`,
    ),

  getFgInventory: (params?: {
    warehouseId?: string;
    binId?: string;
    styleId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => api.get<FgInventoryResponse>('/packing/warehouse/inventory', { params }),

  getFgReconciliation: (styleId?: string) =>
    api.get<FgReconciliationReport>('/packing/warehouse/reconciliation', {
      params: styleId ? { styleId } : undefined,
    }),
};

// -----------------------------------------------------------------------------
// SUB-PHASE 8.3: OUTBOUND LOGISTICS, SHIPMENT, COMMERCIAL INVOICE & GATE PASS
// -----------------------------------------------------------------------------
export const shippingApi = {
  // Shipments
  getShipments: (params?: { buyerId?: string; buyerPoId?: string; status?: string; search?: string; limit?: number }) =>
    api.get<Shipment[]>('/shipping/shipments', { params }),

  getShipmentById: (id: string) =>
    api.get<Shipment>(`/shipping/shipments/${id}`),

  createShipment: (data: CreateShipmentInput, idempotencyKey?: string) =>
    api.post<Shipment>('/shipping/shipments', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),

  assignCartons: (id: string, data: { cartonIds?: string[]; packingListIds?: string[] }) =>
    api.post<Shipment>(`/shipping/shipments/${id}/cartons`, data),

  cancelShipment: (id: string, reason?: string) =>
    api.post<Shipment>(`/shipping/shipments/${id}/cancel`, { reason }),

  // Commercial Invoices
  getInvoices: (params?: { shipmentId?: string; buyerId?: string; status?: string; limit?: number }) =>
    api.get<CommercialInvoice[]>('/shipping/invoices', { params }),

  getInvoiceById: (id: string) =>
    api.get<CommercialInvoice>(`/shipping/invoices/${id}`),

  createInvoice: (data: CreateCommercialInvoiceInput, idempotencyKey?: string) =>
    api.post<CommercialInvoice>('/shipping/invoices', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),

  issueInvoice: (id: string) =>
    api.patch<CommercialInvoice>(`/shipping/invoices/${id}/issue`),

  settleInvoice: (id: string, data: { paymentReference: string; paymentDate: string; paidAmount: number; notes?: string }) =>
    api.post<CommercialInvoice>(`/shipping/invoices/${id}/settle`, data),

  // Outbound Gate Passes & Dispatch
  getGatePasses: (params?: { shipmentId?: string; status?: string; limit?: number }) =>
    api.get<OutboundGatePass[]>('/shipping/gate-pass', { params }),

  getGatePassById: (id: string) =>
    api.get<OutboundGatePass>(`/shipping/gate-pass/${id}`),

  createGatePass: (data: CreateGatePassInput, idempotencyKey?: string) =>
    api.post<OutboundGatePass>('/shipping/gate-pass', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),

  approveGatePass: (id: string) =>
    api.patch<OutboundGatePass>(`/shipping/gate-pass/${id}/approve`),

  cancelGatePass: (id: string, reason?: string) =>
    api.patch<OutboundGatePass>(`/shipping/gate-pass/${id}/cancel`, { reason }),

  dispatchGatePass: (id: string, idempotencyKey?: string) =>
    api.post<OutboundGatePass>(`/shipping/gate-pass/${id}/dispatch`, {}, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),
};

export const dataManagementClient = {
  getSchemas: () =>
    api.get<EntitySchemaDefinition[]>('/data-import/schemas'),

  parseFile: (file: File, worksheet?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (worksheet) formData.append('worksheet', worksheet);
    return api.post<ParseFileResponse>('/data-import/parse-file', formData);
  },

  parseGoogleSheets: (sheetUrl: string, worksheet?: string) =>
    api.post<ParseFileResponse>('/data-import/parse-google-sheets', { sheetUrl, worksheet }),

  previewImport: (data: { entity: string; columnMapping: Record<string, string>; rows: Record<string, any>[] }) =>
    api.post<ImportPreviewResponse>('/data-import/preview', data),

  commitImport: (data: CommitImportRequest, idempotencyKey?: string) =>
    api.post<ImportCommitResponse>('/data-import/commit', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    }),

  getAuditLogs: (params?: { entity?: string; limit?: number }) =>
    api.get<DataImportLog[]>('/data-import/audit', { params }),

  downloadExport: async (entity: string, filters?: Record<string, any>) => {
    const query = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          query.append(k, String(v));
        }
      });
    }
    const qStr = query.toString();
    const token = tokenStorage.getAccessToken();
    const tenantId = tokenStorage.getTenantId();
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    const res = await fetch(`${base}/data-export/${entity}${qStr ? `?${qStr}` : ''}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Export failed' }));
      throw new Error(err.message || 'Export failed');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition');
    let filename = `${entity.toLowerCase()}_export.csv`;
    if (disposition && disposition.includes('filename=')) {
      filename = disposition.split('filename=')[1].replace(/"/g, '').trim();
    }
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  downloadTemplate: async (entity: string, format: 'csv' | 'xlsx') => {
    const token = tokenStorage.getAccessToken();
    const tenantId = tokenStorage.getTenantId();
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    const res = await fetch(`${base}/data-import/templates/${entity}?format=${format}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
      },
    });
    if (!res.ok) throw new Error('Failed to download template');
    const blob = await res.blob();
    const filename = `${entity.toLowerCase()}_template.${format}`;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  downloadErrorReport: async (importId: string) => {
    const token = tokenStorage.getAccessToken();
    const tenantId = tokenStorage.getTenantId();
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    const res = await fetch(`${base}/data-import/audit/${importId}/error-report`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
      },
    });
    if (!res.ok) throw new Error('Failed to download error report');
    const blob = await res.blob();
    const filename = `import_errors_${importId.slice(0, 8)}.csv`;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};



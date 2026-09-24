import { User } from "../api/types";

const ACCESS_TOKEN_KEY = "textile_erp_access_token";
const REFRESH_TOKEN_KEY = "textile_erp_refresh_token";
const TENANT_ID_KEY = "textile_erp_tenant_id";
const USER_CACHE_KEY = "textile_erp_user_cache";

export const tokenStorage = {
  getAccessToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  setAccessToken: (token: string): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    document.cookie = `${ACCESS_TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=900; SameSite=Lax`;
  },

  getRefreshToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  setRefreshToken: (token: string): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
    document.cookie = `${REFRESH_TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;
  },

  getTenantId: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TENANT_ID_KEY);
  },

  setTenantId: (tenantId: string): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(TENANT_ID_KEY, tenantId);
  },

  getUserCache: (): User | null => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(USER_CACHE_KEY);
    try {
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  },

  setUserCache: (user: User): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  },

  clearAll: (): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(TENANT_ID_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
    document.cookie = `${ACCESS_TOKEN_KEY}=; path=/; max-age=0`;
    document.cookie = `${REFRESH_TOKEN_KEY}=; path=/; max-age=0`;
  },
};

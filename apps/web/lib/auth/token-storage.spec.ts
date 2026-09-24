import { tokenStorage } from "./token-storage";

describe("Token and Session Storage", () => {
  beforeEach(() => {
    tokenStorage.clearAll();
  });

  it("should store and retrieve access token", () => {
    tokenStorage.setAccessToken("test-access-token-jwt");
    expect(tokenStorage.getAccessToken()).toBe("test-access-token-jwt");
  });

  it("should store and retrieve refresh token", () => {
    tokenStorage.setRefreshToken("test-refresh-token-jwt");
    expect(tokenStorage.getRefreshToken()).toBe("test-refresh-token-jwt");
  });

  it("should store and retrieve tenant identifier", () => {
    tokenStorage.setTenantId("demo-tenant-1");
    expect(tokenStorage.getTenantId()).toBe("demo-tenant-1");
  });

  it("should store and retrieve cached user object", () => {
    const mockUser = {
      id: "usr-01",
      tenantId: "demo-tenant-1",
      email: "admin@acmetextiles.com",
      firstName: "Admin",
      lastName: "User",
      isActive: true,
      createdAt: "2026-08-25T00:00:00.000Z",
    };
    tokenStorage.setUserCache(mockUser);
    expect(tokenStorage.getUserCache()).toEqual(mockUser);
  });

  it("should clear all tokens and cache upon logout", () => {
    tokenStorage.setAccessToken("token1");
    tokenStorage.setRefreshToken("token2");
    tokenStorage.setUserCache({
      id: "1",
      tenantId: "t1",
      email: "u1@test.com",
      firstName: "Test",
      lastName: "User",
      isActive: true,
      createdAt: "2026-08-25T00:00:00.000Z",
    });

    tokenStorage.clearAll();

    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
    expect(tokenStorage.getTenantId()).toBeNull();
    expect(tokenStorage.getUserCache()).toBeNull();
  });
});

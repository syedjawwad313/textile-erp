import { hasPermission } from "./rbac";

describe("RBAC Permissions Evaluation", () => {
  it("should grant access if user has admin permission or role", () => {
    expect(hasPermission(["ADMIN"], "FACTORY:READ")).toBe(true);
    expect(hasPermission(["*"], "MACHINE:WRITE")).toBe(true);
    expect(hasPermission([], "LINE:READ", true)).toBe(true);
  });

  it("should grant access for exact permission match", () => {
    const permissions = ["FACTORY:READ", "FACTORY:WRITE", "LINE:READ"];
    expect(hasPermission(permissions, "FACTORY:READ")).toBe(true);
    expect(hasPermission(permissions, "FACTORY:WRITE")).toBe(true);
    expect(hasPermission(permissions, "LINE:READ")).toBe(true);
  });

  it("should deny access if permission is missing", () => {
    const permissions = ["FACTORY:READ", "LINE:READ"];
    expect(hasPermission(permissions, "FACTORY:WRITE", false)).toBe(false);
    expect(hasPermission(permissions, "MACHINE:READ", false)).toBe(false);
    expect(hasPermission(permissions, "COSTING:APPROVE", false)).toBe(false);
  });

  it("should grant wildcard resource access", () => {
    const permissions = ["FACTORY:*", "LINE:READ"];
    expect(hasPermission(permissions, "FACTORY:READ")).toBe(true);
    expect(hasPermission(permissions, "FACTORY:WRITE")).toBe(true);
    expect(hasPermission(permissions, "FACTORY:DELETE")).toBe(true);
    expect(hasPermission(permissions, "LINE:WRITE")).toBe(false);
  });
});

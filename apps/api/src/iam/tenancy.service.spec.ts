import { Test, TestingModule } from "@nestjs/testing";
import { TenancyService } from "./tenancy.service";
import { ForbiddenException } from "@nestjs/common";

describe("TenancyService", () => {
  let service: TenancyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenancyService],
    }).compile();

    service = module.get<TenancyService>(TenancyService);
  });

  it("should allow access when tenant IDs match", () => {
    expect(() =>
      service.verifyTenantAccess("tenant-A", "tenant-A"),
    ).not.toThrow();
  });

  it("should deny access and throw ForbiddenException when tenant IDs do not match (Cross-Tenant Access)", () => {
    expect(() => service.verifyTenantAccess("tenant-A", "tenant-B")).toThrow(
      ForbiddenException,
    );
    expect(() => service.verifyTenantAccess("tenant-A", "tenant-B")).toThrow(
      "Tenant access denied. Cross-tenant access is strictly prohibited.",
    );
  });

  it("should return correct prisma scope", () => {
    const scope = service.getTenantScope("tenant-A");
    expect(scope).toEqual({ tenantId: "tenant-A" });
  });
});

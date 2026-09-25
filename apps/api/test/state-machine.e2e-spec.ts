import { Test, TestingModule } from "@nestjs/testing";
import { StateMachineService } from "../src/common/state-machine/state-machine.service";
import { CostingStatus } from "@textile-erp/database";
import { BadRequestException } from "@nestjs/common";
import { prisma } from "@textile-erp/database";

describe("StateMachineService", () => {
  let service: StateMachineService;
  let tenantId: string;
  let costingSheetId: string;
  let costingVersionId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StateMachineService],
    }).compile();

    service = module.get<StateMachineService>(StateMachineService);

    // Setup Test DB State
    const tenant = await prisma.tenant.create({
      data: { name: "State Machine Test Tenant" },
    });
    tenantId = tenant.id;

    const style = await prisma.style.create({
      data: { tenantId, code: "SM-STYLE", name: "Test Style" },
    });
    const sheet = await prisma.costingSheet.create({
      data: { tenantId, styleId: style.id },
    });
    costingSheetId = sheet.id;
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { tenantId } });
    await prisma.costingVersion.deleteMany({ where: { tenantId } });
    await prisma.costingSheet.deleteMany({ where: { tenantId } });
    await prisma.style.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  it("should successfully transition DRAFT -> SUBMITTED and create audit log", async () => {
    const cv = await prisma.costingVersion.create({
      data: {
        tenantId,
        costingSheetId,
        versionNumber: 1,
        status: CostingStatus.DRAFT,
        fabricCost: 10,
        trimsCost: 5,
        cmCost: 2,
        totalCost: 17,
        sellingPrice: 20,
        margin: 0.15,
      },
    });
    costingVersionId = cv.id;

    const result = await service.transitionCosting(
      costingVersionId,
      tenantId,
      "actor-1",
      CostingStatus.DRAFT,
      CostingStatus.SUBMITTED,
      "Ready for review",
    );

    expect(result.status).toBe(CostingStatus.SUBMITTED);

    const audit = await prisma.auditEvent.findFirst({
      where: { entityId: costingVersionId, action: "STATE_TRANSITION" },
      orderBy: { timestamp: "desc" },
    });
    expect(audit).toBeDefined();
    expect(audit?.newValues).toEqual({ status: "SUBMITTED" });
  });

  it("should throw BadRequestException for invalid transition DRAFT -> APPROVED", async () => {
    const cv = await prisma.costingVersion.create({
      data: {
        tenantId,
        costingSheetId,
        versionNumber: 2,
        status: CostingStatus.DRAFT,
        fabricCost: 10,
        trimsCost: 5,
        cmCost: 2,
        totalCost: 17,
        sellingPrice: 20,
        margin: 0.15,
      },
    });

    await expect(
      service.transitionCosting(
        cv.id,
        tenantId,
        "actor-1",
        CostingStatus.DRAFT,
        CostingStatus.APPROVED,
        "Direct approve",
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

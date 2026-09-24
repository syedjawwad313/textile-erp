import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma } from '@textile-erp/database';
import { CostingStatus } from '@textile-erp/database';
import { CostingEngineService } from './costing-engine.service';
import { StateMachineService } from '../common/state-machine/state-machine.service';
import { CreateCostingSheetDto, CreateCostingVersionDto, CreateBomLineDto, CalculateCostingDto } from './dto/costing.dto';

@Injectable()
export class CostingService {
  constructor(
    private readonly costingEngine: CostingEngineService,
    private readonly stateMachine: StateMachineService,
  ) {}

  async createSheet(tenantId: string, dto: CreateCostingSheetDto) {
    return prisma.costingSheet.create({
      data: {
        tenantId,
        styleId: dto.styleId,
      },
    });
  }

  async getSheets(tenantId: string) {
    return prisma.costingSheet.findMany({ where: { tenantId } });
  }

  async createVersion(tenantId: string, sheetId: string, dto: CreateCostingVersionDto) {
    const sheet = await prisma.costingSheet.findUnique({ where: { id: sheetId } });
    if (!sheet || sheet.tenantId !== tenantId) throw new NotFoundException('CostingSheet not found');

    return prisma.costingVersion.create({
      data: {
        tenantId,
        costingSheetId: sheetId,
        versionNumber: dto.versionNumber,
        status: CostingStatus.DRAFT,
        fabricCost: 0,
        trimsCost: 0,
        cmCost: 0,
        totalCost: 0,
        sellingPrice: 0,
        margin: 0,
      },
    });
  }

  async getVersions(tenantId: string, sheetId: string) {
    return prisma.costingVersion.findMany({ where: { tenantId, costingSheetId: sheetId } });
  }

  async addBomLine(tenantId: string, versionId: string, dto: CreateBomLineDto) {
    const version = await prisma.costingVersion.findUnique({ where: { id: versionId } });
    if (!version || version.tenantId !== tenantId) throw new NotFoundException('CostingVersion not found');
    if (version.status !== CostingStatus.DRAFT) throw new BadRequestException('Can only modify DRAFT versions');

    const totalCost = Number(dto.consumption) * (1 + Number(dto.wastagePercent)) * Number(dto.unitCost);

    return prisma.bomLine.create({
      data: {
        costingVersionId: versionId,
        materialId: dto.materialId,
        consumption: dto.consumption,
        wastagePercent: dto.wastagePercent,
        unitCost: dto.unitCost,
        totalCost,
      },
    });
  }

  async calculate(tenantId: string, versionId: string, dto: CalculateCostingDto) {
    const version = await prisma.costingVersion.findUnique({
      where: { id: versionId },
      include: { bomLines: { include: { material: true } } },
    });
    if (!version || version.tenantId !== tenantId) throw new NotFoundException('CostingVersion not found');
    if (version.status !== CostingStatus.DRAFT) throw new BadRequestException('Can only calculate DRAFT versions');

    let fabricCost = 0;
    let trimsCost = 0;
    let cmCost = 0; // Keeping CM as 0 for BOM-based derivation or it could be derived differently. For simplicity we use 0 or pass it in.

    for (const line of version.bomLines) {
      if (line.material.category === 'FABRIC') fabricCost += Number(line.totalCost);
      else if (line.material.category === 'TRIM') trimsCost += Number(line.totalCost);
    }

    const { totalCost, margin } = this.costingEngine.calculateCosting(
      fabricCost,
      trimsCost,
      cmCost,
      dto.overheads,
      dto.freight,
      dto.rejectionBuffer,
      dto.sellingPrice
    );

    return prisma.costingVersion.update({
      where: { id: versionId },
      data: {
        fabricCost,
        trimsCost,
        cmCost,
        totalCost,
        sellingPrice: dto.sellingPrice,
        margin,
      },
    });
  }

  async submit(tenantId: string, actorId: string, versionId: string) {
    const version = await prisma.costingVersion.findUnique({ where: { id: versionId } });
    if (!version || version.tenantId !== tenantId) throw new NotFoundException('CostingVersion not found');
    
    // Using StateMachineService for transition and audit
    return this.stateMachine.transitionCosting(
      versionId,
      tenantId,
      actorId,
      version.status,
      CostingStatus.SUBMITTED,
      'Submitted for Approval'
    );
  }

  async approve(tenantId: string, actorId: string, versionId: string) {
    const version = await prisma.costingVersion.findUnique({ where: { id: versionId } });
    if (!version || version.tenantId !== tenantId) throw new NotFoundException('CostingVersion not found');

    const policy = await prisma.marginApprovalPolicy.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!policy) throw new BadRequestException('No active Margin Approval Policy found for tenant');

    const action = this.costingEngine.evaluateApprovalPolicy(Number(version.margin), policy);
    
    if (action === 'BLOCKED_LOW_MARGIN') {
      throw new BadRequestException('Margin is too low for approval based on policy.');
    }

    // If AUTO_APPROVED or MANUAL_APPROVAL_REQUIRED, we can transition it. 
    // In a real scenario, MANUAL_APPROVAL_REQUIRED might require a specific role, 
    // but the controller endpoint @SetMetadata('permission', 'COSTING:APPROVE') handles the role.
    
    // Determine target state based on current state and policy
    let targetState = CostingStatus.APPROVED;
    
    // If it's currently submitted and policy requires manual, we could move to PENDING_APPROVAL or APPROVED based on who calls this.
    // The requirement says "Submit -> Approve". We will move directly to APPROVED if the user has the 'COSTING:APPROVE' permission.
    
    return this.stateMachine.transitionCosting(
      versionId,
      tenantId,
      actorId,
      version.status,
      targetState,
      `Approved. Policy Evaluation: ${action}`
    );
  }
}

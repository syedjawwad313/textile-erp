import { Test, TestingModule } from '@nestjs/testing';
import { CostingEngineService } from './costing-engine.service';
import { BadRequestException } from '@nestjs/common';
import { MarginApprovalPolicy, Prisma } from '@textile-erp/database';

describe('CostingEngineService', () => {
  let service: CostingEngineService;

  const mockPolicy: MarginApprovalPolicy = {
    id: 'mock-policy-1',
    tenantId: 'tenant-1',
    autoApprovalThreshold: new Prisma.Decimal(0.25) as any,
    manualApprovalThreshold: new Prisma.Decimal(0.15) as any,
    lowMarginAction: 'BLOCKED',
    isActive: true,
    effectiveFrom: new Date(),
    effectiveTo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CostingEngineService],
    }).compile();

    service = module.get<CostingEngineService>(CostingEngineService);
  });

  describe('evaluateApprovalPolicy', () => {
    it('should return AUTO_APPROVED for margins strictly greater than auto threshold', () => {
      expect(service.evaluateApprovalPolicy(0.26, mockPolicy)).toBe('AUTO_APPROVED');
      expect(service.evaluateApprovalPolicy(0.50, mockPolicy)).toBe('AUTO_APPROVED');
    });

    it('should return MANUAL_APPROVAL_REQUIRED for margins between manual and auto thresholds', () => {
      expect(service.evaluateApprovalPolicy(0.20, mockPolicy)).toBe('MANUAL_APPROVAL_REQUIRED');
      expect(service.evaluateApprovalPolicy(0.15, mockPolicy)).toBe('MANUAL_APPROVAL_REQUIRED');
      expect(service.evaluateApprovalPolicy(0.25, mockPolicy)).toBe('MANUAL_APPROVAL_REQUIRED');
    });

    it('should return BLOCKED_LOW_MARGIN for margins strictly less than manual threshold', () => {
      expect(service.evaluateApprovalPolicy(0.14, mockPolicy)).toBe('BLOCKED_LOW_MARGIN');
      expect(service.evaluateApprovalPolicy(0.05, mockPolicy)).toBe('BLOCKED_LOW_MARGIN');
    });
  });
});

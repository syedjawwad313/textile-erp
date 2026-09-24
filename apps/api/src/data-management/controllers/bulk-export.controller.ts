import { Controller, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '../../iam/auth.guard';
import { RbacGuard } from '../../iam/rbac.guard';
import { SetMetadata } from '@nestjs/common';
import { BulkExportService } from '../services/bulk-export.service';
import { ExportQueryDto } from '../dto/data-management.dto';
import { SupportedExportEntity } from '../interfaces/entity-schema.interface';

@Controller(['data-export', 'export'])
@UseGuards(AuthGuard, RbacGuard)
export class BulkExportController {
  constructor(private readonly bulkExportService: BulkExportService) {}

  /**
   * Normalizes URL route entity param to SupportedExportEntity enum format.
   * e.g. "buyers" -> "BUYER", "buyer-pos" -> "BUYER_PO", "production-orders" -> "PRODUCTION_ORDER"
   */
  private normalizeEntity(entity: string): SupportedExportEntity {
    const clean = entity.toUpperCase().replace(/-/g, '_').trim();
    const singularMap: Record<string, SupportedExportEntity> = {
      BUYERS: 'BUYER',
      SUPPLIERS: 'SUPPLIER',
      STYLES: 'STYLE',
      MATERIALS: 'MATERIAL',
      WAREHOUSES: 'WAREHOUSE',
      BINS: 'BIN',
      DEFECTS: 'DEFECT',
      DEFECT_CATALOGS: 'DEFECT_CATALOG',
      BUYER_POS: 'BUYER_PO',
      BUYER_PO_LINES: 'BUYER_PO_LINE',
      PRODUCTION_ORDERS: 'PRODUCTION_ORDER',
      PRODUCTION_PLANS: 'PRODUCTION_PLAN',
      CUTTING_RECORDS: 'CUTTING_RECORD',
      BUNDLES: 'BUNDLE',
      PRODUCTION_OUTPUTS: 'PRODUCTION_OUTPUT',
      QUALITY_INSPECTIONS: 'QUALITY_INSPECTION',
      NCRS: 'NCR',
      CAPAS: 'CAPA',
      INVENTORIES: 'INVENTORY',
      FABRIC_ROLLS: 'FABRIC_ROLL',
      CARTONS: 'CARTON',
      PACKING_LISTS: 'PACKING_LIST',
      SHIPMENTS: 'SHIPMENT',
      SHIPMENT_ITEMS: 'SHIPMENT_ITEM',
      COMMERCIAL_INVOICES: 'COMMERCIAL_INVOICE',
      GATE_PASSES: 'GATE_PASS',
      VPOS: 'VPO',
      JOB_COSTS: 'COSTING_SUMMARY',
      COSTING_SUMMARIES: 'COSTING_SUMMARY',
    };
    return singularMap[clean] || (clean as SupportedExportEntity);
  }

  /**
   * Exports filtered, tenant-scoped tabular data as CSV with formula-injection sanitization.
   */
  @Get(':entity')
  @SetMetadata('permission', 'DATA:EXPORT')
  async exportCsv(
    @Req() req: any,
    @Param('entity') entityParam: string,
    @Query() filters: ExportQueryDto,
    @Res() res: Response,
  ) {
    const tenantId = req.user.tenantId;
    const entity = this.normalizeEntity(entityParam);

    const { csv, filename } = await this.bulkExportService.exportToCsv(tenantId, entity, filters);

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': Buffer.byteLength(csv, 'utf-8'),
    });
    res.end(csv);
  }
}

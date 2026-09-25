import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Request,
  SetMetadata,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import * as crypto from "crypto";
import { AuthGuard } from "../../iam/auth.guard";
import { RbacGuard } from "../../iam/rbac.guard";
import { ShipmentService } from "../services/shipment.service";
import { CommercialInvoiceService } from "../services/commercial-invoice.service";
import { GatePassService } from "../services/gate-pass.service";
import {
  CreateShipmentDto,
  AssignCartonsToShipmentDto,
  QueryShipmentsDto,
  CreateCommercialInvoiceDto,
  QueryInvoicesDto,
  CreateGatePassDto,
  QueryGatePassesDto,
  SettleCommercialInvoiceDto,
} from "../dto/shipping.dto";

function extractTenantAndActor(req: any) {
  const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
  const actorId = req.user?.sub || req.user?.id || "system";
  return { tenantId, actorId };
}

@Controller("shipping")
@UseGuards(AuthGuard, RbacGuard)
export class ShippingController {
  constructor(
    private readonly shipmentService: ShipmentService,
    private readonly invoiceService: CommercialInvoiceService,
    private readonly gatePassService: GatePassService,
  ) {}

  // ---------------------------------------------------------------------------
  // SHIPMENTS
  // ---------------------------------------------------------------------------

  @Post("shipments")
  @SetMetadata("permission", "SHIPPING:WRITE")
  async createShipment(
    @Request() req: any,
    @Headers("x-idempotency-key") headerIdempotencyKey: string,
    @Body() dto: CreateShipmentDto,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    const idempotencyKey =
      headerIdempotencyKey ||
      (dto as any)?.idempotencyKey ||
      `shipment-init-${crypto.randomUUID()}`;
    return this.shipmentService.createShipment(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }

  @Get("shipments")
  @SetMetadata("permission", "SHIPPING:READ")
  async getShipments(@Request() req: any, @Query() query: QueryShipmentsDto) {
    const { tenantId } = extractTenantAndActor(req);
    return this.shipmentService.getShipments(tenantId, query);
  }

  @Get("shipments/:id")
  @SetMetadata("permission", "SHIPPING:READ")
  async getShipmentById(@Request() req: any, @Param("id") id: string) {
    const { tenantId } = extractTenantAndActor(req);
    return this.shipmentService.getShipmentById(tenantId, id);
  }

  @Post("shipments/:id/cartons")
  @SetMetadata("permission", "SHIPPING:WRITE")
  async assignCartons(
    @Request() req: any,
    @Param("id") id: string,
    @Body() dto: AssignCartonsToShipmentDto,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.shipmentService.assignCartons(tenantId, actorId, id, dto);
  }

  @Post("shipments/:id/cancel")
  @HttpCode(HttpStatus.OK)
  @SetMetadata("permission", "SHIPPING:WRITE")
  async cancelShipment(
    @Request() req: any,
    @Param("id") id: string,
    @Body("reason") reason?: string,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.shipmentService.cancelShipment(tenantId, actorId, id, reason);
  }

  // ---------------------------------------------------------------------------
  // COMMERCIAL INVOICES
  // ---------------------------------------------------------------------------

  @Post("invoices")
  @SetMetadata("permission", "SHIPPING:WRITE")
  async createInvoice(
    @Request() req: any,
    @Headers("x-idempotency-key") headerIdempotencyKey: string,
    @Body() dto: CreateCommercialInvoiceDto,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    const idempotencyKey =
      headerIdempotencyKey ||
      (dto as any)?.idempotencyKey ||
      `inv-init-${crypto.randomUUID()}`;
    return this.invoiceService.createInvoice(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }

  @Get("invoices")
  @SetMetadata("permission", "SHIPPING:READ")
  async getInvoices(@Request() req: any, @Query() query: QueryInvoicesDto) {
    const { tenantId } = extractTenantAndActor(req);
    return this.invoiceService.getInvoices(tenantId, query);
  }

  @Get("invoices/:id")
  @SetMetadata("permission", "SHIPPING:READ")
  async getInvoiceById(@Request() req: any, @Param("id") id: string) {
    const { tenantId } = extractTenantAndActor(req);
    return this.invoiceService.getInvoiceById(tenantId, id);
  }

  @Post("invoices/:id/issue")
  @HttpCode(HttpStatus.OK)
  @SetMetadata("permission", "SHIPPING:WRITE")
  async issueInvoicePost(@Request() req: any, @Param("id") id: string) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.invoiceService.issueInvoice(tenantId, actorId, id);
  }

  @Patch("invoices/:id/issue")
  @SetMetadata("permission", "SHIPPING:WRITE")
  async issueInvoicePatch(@Request() req: any, @Param("id") id: string) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.invoiceService.issueInvoice(tenantId, actorId, id);
  }

  @Post("invoices/:id/settle")
  @HttpCode(HttpStatus.OK)
  @SetMetadata("permission", "SHIPPING:WRITE")
  async settleInvoice(
    @Request() req: any,
    @Param("id") id: string,
    @Body() dto: SettleCommercialInvoiceDto,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.invoiceService.settleInvoice(tenantId, actorId, id, dto);
  }

  // ---------------------------------------------------------------------------
  // OUTBOUND GATE PASSES & PHYSICAL DISPATCH
  // ---------------------------------------------------------------------------

  @Post("gate-pass")
  @SetMetadata("permission", "SHIPPING:WRITE")
  async createGatePass(
    @Request() req: any,
    @Headers("x-idempotency-key") headerIdempotencyKey: string,
    @Body() dto: CreateGatePassDto,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    const idempotencyKey =
      headerIdempotencyKey ||
      (dto as any)?.idempotencyKey ||
      `gp-init-${crypto.randomUUID()}`;
    return this.gatePassService.createGatePass(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }

  @Get("gate-pass")
  @SetMetadata("permission", "SHIPPING:READ")
  async getGatePasses(@Request() req: any, @Query() query: QueryGatePassesDto) {
    const { tenantId } = extractTenantAndActor(req);
    return this.gatePassService.getGatePasses(tenantId, query);
  }

  @Get("gate-pass/:id")
  @SetMetadata("permission", "SHIPPING:READ")
  async getGatePassById(@Request() req: any, @Param("id") id: string) {
    const { tenantId } = extractTenantAndActor(req);
    return this.gatePassService.getGatePassById(tenantId, id);
  }

  @Post("gate-pass/:id/approve")
  @HttpCode(HttpStatus.OK)
  @SetMetadata("permission", "SHIPPING:APPROVE")
  async approveGatePassPost(@Request() req: any, @Param("id") id: string) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.gatePassService.approveGatePass(tenantId, actorId, id);
  }

  @Patch("gate-pass/:id/approve")
  @SetMetadata("permission", "SHIPPING:APPROVE")
  async approveGatePassPatch(@Request() req: any, @Param("id") id: string) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.gatePassService.approveGatePass(tenantId, actorId, id);
  }

  @Post("gate-pass/:id/cancel")
  @HttpCode(HttpStatus.OK)
  @SetMetadata("permission", "SHIPPING:WRITE")
  async cancelGatePassPost(
    @Request() req: any,
    @Param("id") id: string,
    @Body("reason") reason?: string,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.gatePassService.cancelGatePass(tenantId, actorId, id, reason);
  }

  @Patch("gate-pass/:id/cancel")
  @SetMetadata("permission", "SHIPPING:WRITE")
  async cancelGatePassPatch(
    @Request() req: any,
    @Param("id") id: string,
    @Body("reason") reason?: string,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.gatePassService.cancelGatePass(tenantId, actorId, id, reason);
  }

  @Post("gate-pass/:id/dispatch")
  @HttpCode(HttpStatus.OK)
  @SetMetadata("permission", "SHIPPING:WRITE")
  async dispatchGatePass(
    @Request() req: any,
    @Headers("x-idempotency-key") headerIdempotencyKey: string,
    @Param("id") id: string,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    const idempotencyKey = headerIdempotencyKey || `gp-dispatch-${id}`;
    return this.gatePassService.dispatchGatePass(
      tenantId,
      actorId,
      idempotencyKey,
      id,
    );
  }
}

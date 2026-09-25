import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  SetMetadata,
  Req,
} from "@nestjs/common";
import { EmployeeService } from "../services/employee.service";
import { CreateEmployeeDto, UpdateEmployeeDto } from "../dto/master-data.dto";
import { AuthGuard } from "../../iam/auth.guard";
import { RbacGuard } from "../../iam/rbac.guard";
import { Request } from "express";

@Controller("employees")
@UseGuards(AuthGuard, RbacGuard)
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  @SetMetadata("permission", "EMPLOYEE:WRITE")
  create(@Req() req: Request, @Body() createEmployeeDto: CreateEmployeeDto) {
    const tenantId = (req as any).user.tenantId;
    return this.employeeService.create(tenantId, createEmployeeDto);
  }

  @Get()
  @SetMetadata("permission", "EMPLOYEE:READ")
  findAll(@Req() req: Request) {
    const tenantId = (req as any).user.tenantId;
    return this.employeeService.findAll(tenantId);
  }

  @Get(":id")
  @SetMetadata("permission", "EMPLOYEE:READ")
  findOne(@Req() req: Request, @Param("id") id: string) {
    const tenantId = (req as any).user.tenantId;
    return this.employeeService.findOne(tenantId, id);
  }

  @Patch(":id")
  @SetMetadata("permission", "EMPLOYEE:WRITE")
  update(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ) {
    const tenantId = (req as any).user.tenantId;
    return this.employeeService.update(tenantId, id, updateEmployeeDto);
  }
}

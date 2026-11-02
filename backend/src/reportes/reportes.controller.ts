import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '../usuarios/usuario.entity';
import { ReportesService } from './reportes.service';

@Roles(RolUsuario.DIRECTOR)
@Controller('reportes')
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  @Get('resumen-asistencia')
  resumen() {
    return this.service.resumenIngreso();
  }

  @Get('asistencia')
  asistencia() {
    return this.service.asistenciaUltimosSieteDias();
  }

  @Get('evasiones-recientes')
  evasionesRecientes() {
    return this.service.evasionesRecientes();
  }
}

import {
  BadRequestException, Body, Controller, Get, HttpCode, ParseIntPipe, Patch, Post, Query,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolUsuario, Usuario } from '../../usuarios/usuario.entity';
import { AsistenciaIngresoService } from './asistencia-ingreso.service';
import { RegistroManualDto } from './dto/registro-manual.dto';
import { ScanIngresoDto } from './dto/scan-ingreso.dto';
import { ConfigurarIngresoDto } from './dto/configurar-ingreso.dto';

@Roles(RolUsuario.DIRECTOR, RolUsuario.AUXILIAR)
@Controller('asistencia/ingreso')
export class AsistenciaIngresoController {
  constructor(private readonly service: AsistenciaIngresoService) {}

  @Get('configuracion')
  configuracion() {
    return this.service.obtenerConfiguracion();
  }

  @Roles(RolUsuario.AUXILIAR)
  @Patch('configuracion')
  actualizarConfiguracion(@Body() dto: ConfigurarIngresoDto) {
    return this.service.actualizarConfiguracion(dto);
  }

  @Post('scan')
  @HttpCode(200)
  scan(@Body() dto: ScanIngresoDto, @CurrentUser() usuario: Usuario) {
    return this.service.scan(dto, usuario);
  }

  @Post('manual')
  manual(@Body() dto: RegistroManualDto, @CurrentUser() usuario: Usuario) {
    return this.service.registrarManual(dto, usuario);
  }

  @Get()
  listar(
    @Query('seccionId', ParseIntPipe) seccionId: number,
    @Query('fecha') fecha?: string,
  ) {
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new BadRequestException('fecha debe tener formato YYYY-MM-DD');
    }
    return this.service.listarSeccion(seccionId, fecha);
  }
}

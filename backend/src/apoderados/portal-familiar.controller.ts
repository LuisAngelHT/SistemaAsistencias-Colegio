import {
  BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario, Usuario } from '../usuarios/usuario.entity';
import { CrearSolicitudJustificacionDto } from './dto/crear-solicitud-justificacion.dto';
import { RevisarSolicitudJustificacionDto } from './dto/revisar-solicitud-justificacion.dto';
import { PortalFamiliarService } from './portal-familiar.service';
import { AccesoFamiliarDto } from './dto/acceso-familiar.dto';

@Controller('portal-familiar')
export class AccesoFamiliarController {
  constructor(private readonly service: PortalFamiliarService) {}

  @Public()
  @Post('acceso')
  acceder(@Body() dto: AccesoFamiliarDto) {
    return this.service.iniciarAcceso(dto);
  }
}

@Roles(RolUsuario.APODERADO)
@Controller('portal-familiar')
export class PortalFamiliarController {
  constructor(private readonly service: PortalFamiliarService) {}

  @Get('alumnos')
  listarAlumnos(@CurrentUser() usuario: { alumnoId: string }) {
    return this.service.listarAlumnos(usuario.alumnoId);
  }

  @Get('alumnos/:alumnoId/asistencias')
  listarAsistencias(
    @CurrentUser() usuario: { alumnoId: string },
    @Param('alumnoId', ParseUUIDPipe) alumnoId: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
  ) {
    if (!desde || !hasta) throw new BadRequestException('Indica desde y hasta');
    return this.service.listarAsistencias(usuario.alumnoId, alumnoId, desde, hasta);
  }

  @Get('alumnos/:alumnoId/reporte-asistencias')
  exportarAsistencias(
    @CurrentUser() usuario: { alumnoId: string },
    @Param('alumnoId', ParseUUIDPipe) alumnoId: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
  ) {
    if (!desde || !hasta) throw new BadRequestException('Indica desde y hasta');
    return this.service.exportarAsistencias(usuario.alumnoId, alumnoId, desde, hasta);
  }

  @Get('solicitudes')
  listarSolicitudes(@CurrentUser() usuario: { alumnoId: string }) {
    return this.service.listarSolicitudesFamilia(usuario.alumnoId);
  }

  @Post('solicitudes')
  crearSolicitud(
    @CurrentUser() usuario: { alumnoId: string },
    @Body() dto: CrearSolicitudJustificacionDto,
  ) {
    return this.service.crearSolicitud(usuario.alumnoId, dto);
  }
}

@Roles(RolUsuario.AUXILIAR)
@Controller('solicitudes-justificacion')
export class SolicitudesJustificacionController {
  constructor(private readonly service: PortalFamiliarService) {}

  @Get('count')
  contarPendientes() {
    return this.service.contarPendientes();
  }

  @Get()
  listarPendientes() {
    return this.service.listarPendientes();
  }

  @Patch(':id')
  revisar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevisarSolicitudJustificacionDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.service.revisarSolicitud(id, dto, usuario.id);
  }
}

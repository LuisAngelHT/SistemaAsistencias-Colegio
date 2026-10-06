import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '../usuarios/usuario.entity';
import { ApoderadoService } from './apoderado.service';
import { UpdateVinculoDto, VincularApoderadoDto } from './dto/vincular-apoderado.dto';

@Roles(RolUsuario.DIRECTOR)
@Controller('alumnos/:alumnoId/apoderados')
export class AlumnoApoderadosController {
  constructor(private readonly service: ApoderadoService) {}

  @Roles(RolUsuario.DIRECTOR, RolUsuario.AUXILIAR)
  @Get()
  listar(@Param('alumnoId', ParseUUIDPipe) alumnoId: string) {
    return this.service.listarDeAlumno(alumnoId);
  }

  @Post()
  vincular(
    @Param('alumnoId', ParseUUIDPipe) alumnoId: string,
    @Body() dto: VincularApoderadoDto,
  ) {
    return this.service.vincular(alumnoId, dto);
  }

  @Patch(':apoderadoId')
  actualizar(
    @Param('alumnoId', ParseUUIDPipe) alumnoId: string,
    @Param('apoderadoId', ParseUUIDPipe) apoderadoId: string,
    @Body() dto: UpdateVinculoDto,
  ) {
    return this.service.actualizarVinculo(alumnoId, apoderadoId, dto);
  }

  @Delete(':apoderadoId')
  desvincular(
    @Param('alumnoId', ParseUUIDPipe) alumnoId: string,
    @Param('apoderadoId', ParseUUIDPipe) apoderadoId: string,
  ) {
    return this.service.desvincular(alumnoId, apoderadoId);
  }
}
import {
  BadRequestException, Body, Controller, Get, Param, ParseIntPipe,
  ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '../usuarios/usuario.entity';
import { MatriculaService } from './matricula.service';
import { EstadoMatricula } from './matricula.entity';
import { CreateMatriculaDto } from './dto/create-matricula.dto';
import { CambiarSeccionDto } from './dto/cambiar-seccion.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';
import { HorarioService } from '../horarios/horario.service';
import { ForbiddenException } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Usuario } from '../usuarios/usuario.entity';

@Roles(RolUsuario.DIRECTOR)
@Controller('matriculas')
export class MatriculaController {
  constructor(
    private readonly service: MatriculaService,
    private readonly horarios: HorarioService
  ) {}

  @Post()
  create(@Body() dto: CreateMatriculaDto) {
    return this.service.create(dto);
  }

  @Roles(RolUsuario.DIRECTOR, RolUsuario.AUXILIAR, RolUsuario.PROFESOR)
  @Get()
  async findAll(
    @CurrentUser() usuario: Usuario,
    @Query('seccionId', new ParseIntPipe({ optional: true })) seccionId?: number,
    @Query('alumnoId', new ParseUUIDPipe({ optional: true })) alumnoId?: string,
    @Query('estado') estado?: string,
  ) {
    if (usuario.rol === RolUsuario.PROFESOR) {
      const permitido = seccionId && (await this.horarios.profesorTieneSeccion(usuario.id, seccionId));
      if (!permitido) {
        throw new ForbiddenException('Solo puedes ver las secciones donde dictas clase');
      }
    }
    if (estado && !Object.values(EstadoMatricula).includes(estado as EstadoMatricula)) {
      throw new BadRequestException('estado inválido');
    }
    return this.service.findAll({ seccionId, alumnoId, estado: estado as EstadoMatricula });
  }

  @Roles(RolUsuario.DIRECTOR, RolUsuario.AUXILIAR)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/seccion')
  cambiarSeccion(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CambiarSeccionDto) {
    return this.service.cambiarSeccion(id, dto.seccionId);
  }

  @Patch(':id/estado')
  cambiarEstado(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CambiarEstadoDto) {
    return this.service.cambiarEstado(id, dto.estado);
  }
}
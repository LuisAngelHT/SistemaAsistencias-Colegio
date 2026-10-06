import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { enLima } from '../common/fecha-lima';
import { RolUsuario, Usuario } from '../usuarios/usuario.entity';
import { HorarioService } from './horario.service';
import { CreateHorarioDto } from './dto/create-horario.dto';
import { UpdateHorarioDto } from './dto/update-horario.dto';

@Roles(RolUsuario.DIRECTOR)
@Controller('horarios')
export class HorarioController {
  constructor(private readonly service: HorarioService) {}

  @Post()
  create(@Body() dto: CreateHorarioDto) {
    return this.service.create(dto);
  }

  @Roles(RolUsuario.DIRECTOR, RolUsuario.AUXILIAR)
  @Get()
  findAll(
    @Query('seccionId', new ParseIntPipe({ optional: true })) seccionId?: number,
    @Query('profesorId', new ParseUUIDPipe({ optional: true })) profesorId?: string,
    @Query('diaSemana', new ParseIntPipe({ optional: true })) diaSemana?: number,
  ) {
    return this.service.findAll({ seccionId, profesorId, diaSemana });
  }

  // Estas dos rutas van ANTES de ':id' para que "mis-horarios" no se tome como un id
  @Roles(RolUsuario.PROFESOR)
  @Get('mis-horarios')
  misHorarios(
    @CurrentUser() usuario: Usuario,
    @Query('dia', new ParseIntPipe({ optional: true })) dia?: number,
  ) {
    return this.service.misHorarios(usuario.id, dia);
  }

  @Roles(RolUsuario.PROFESOR)
  @Get('mis-horarios/hoy')
  misHorariosHoy(@CurrentUser() usuario: Usuario) {
    return this.service.misHorarios(usuario.id, enLima().diaSemana);
  }

  @Roles(RolUsuario.DIRECTOR, RolUsuario.AUXILIAR)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateHorarioDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
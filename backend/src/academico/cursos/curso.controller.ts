import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query,
} from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolUsuario } from '../../usuarios/usuario.entity';
import { CursoService } from './curso.service';
import { CreateCursoDto } from './dto/create-curso.dto';
import { UpdateCursoDto } from './dto/update-curso.dto';

@Roles(RolUsuario.DIRECTOR)
@Controller('cursos')
export class CursoController {
  constructor(private readonly service: CursoService) {}

  @Post()
  create(@Body() dto: CreateCursoDto) {
    return this.service.create(dto);
  }

  @Roles(RolUsuario.DIRECTOR, RolUsuario.AUXILIAR, RolUsuario.PROFESOR)
  @Get()
  findAll(@Query('activos') activos?: string) {
    return this.service.findAll(activos === 'true');
  }

  @Roles(RolUsuario.DIRECTOR, RolUsuario.AUXILIAR, RolUsuario.PROFESOR)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCursoDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
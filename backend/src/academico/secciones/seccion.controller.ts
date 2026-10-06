import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query,
} from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolUsuario } from '../../usuarios/usuario.entity';
import { SeccionService } from './seccion.service';
import { CreateSeccionDto } from './dto/create-seccion.dto';
import { UpdateSeccionDto } from './dto/update-seccion.dto';

@Roles(RolUsuario.DIRECTOR)
@Controller('secciones')
export class SeccionController {
  constructor(private readonly service: SeccionService) {}

  @Post()
  create(@Body() dto: CreateSeccionDto) {
    return this.service.create(dto);
  }

  @Roles(RolUsuario.DIRECTOR, RolUsuario.AUXILIAR, RolUsuario.PROFESOR)
  @Get()
  findAll(
    @Query('anioId', new ParseIntPipe({ optional: true })) anioId?: number,
    @Query('gradoId', new ParseIntPipe({ optional: true })) gradoId?: number,
  ) {
    return this.service.findAll({ anioId, gradoId });
  }

  @Roles(RolUsuario.DIRECTOR, RolUsuario.AUXILIAR, RolUsuario.PROFESOR)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSeccionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
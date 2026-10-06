import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query,
} from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolUsuario } from '../../usuarios/usuario.entity';
import { GradoService } from './grado.service';
import { NivelEducativo } from './grado.entity';
import { CreateGradoDto } from './dto/create-grado.dto';
import { UpdateGradoDto } from './dto/update-grado.dto';

@Roles(RolUsuario.DIRECTOR)
@Controller('grados')
export class GradoController {
  constructor(private readonly service: GradoService) {}

  @Post()
  create(@Body() dto: CreateGradoDto) {
    return this.service.create(dto);
  }

  @Roles(RolUsuario.DIRECTOR, RolUsuario.AUXILIAR, RolUsuario.PROFESOR)
  @Get()
  findAll(@Query('nivel') nivel?: NivelEducativo) {
    return this.service.findAll(nivel);
  }

  @Roles(RolUsuario.DIRECTOR, RolUsuario.AUXILIAR, RolUsuario.PROFESOR)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGradoDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
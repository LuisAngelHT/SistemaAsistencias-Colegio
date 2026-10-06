import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post,
} from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolUsuario } from '../../usuarios/usuario.entity';
import { AnioAcademicoService } from './anio-academico.service';
import { CreateAnioAcademicoDto } from './dto/create-anio-academico.dto';
import { UpdateAnioAcademicoDto } from './dto/update-anio-academico.dto';

@Roles(RolUsuario.DIRECTOR)
@Controller('anios-academicos')
export class AnioAcademicoController {
  constructor(private readonly service: AnioAcademicoService) {}

  @Post()
  create(@Body() dto: CreateAnioAcademicoDto) {
    return this.service.create(dto);
  }

  @Roles(RolUsuario.DIRECTOR, RolUsuario.AUXILIAR, RolUsuario.PROFESOR)
  @Get()
  findAll() {
    return this.service.findAll();
  }

  // Importante: va antes de ':id' para que "activo" no se interprete como un id
  @Roles(RolUsuario.DIRECTOR, RolUsuario.AUXILIAR, RolUsuario.PROFESOR)
  @Get('activo')
  findActivo() {
    return this.service.findActivo();
  }

  @Roles(RolUsuario.DIRECTOR, RolUsuario.AUXILIAR, RolUsuario.PROFESOR)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAnioAcademicoDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/activar')
  activar(@Param('id', ParseIntPipe) id: number) {
    return this.service.activar(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
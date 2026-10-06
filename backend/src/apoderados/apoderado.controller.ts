import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '../usuarios/usuario.entity';
import { ApoderadoService } from './apoderado.service';
import { CreateApoderadoDto } from './dto/create-apoderado.dto';
import { UpdateApoderadoDto } from './dto/update-apoderado.dto';

@Roles(RolUsuario.DIRECTOR)
@Controller('apoderados')
export class ApoderadoController {
  constructor(private readonly service: ApoderadoService) {}

  @Post()
  create(@Body() dto: CreateApoderadoDto) {
    return this.service.create(dto);
  }

  @Roles(RolUsuario.DIRECTOR, RolUsuario.AUXILIAR)
  @Get()
  findAll(@Query('q') q?: string) {
    return this.service.findAll(q);
  }

  @Roles(RolUsuario.DIRECTOR, RolUsuario.AUXILIAR)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateApoderadoDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.desactivar(id);
  }
}
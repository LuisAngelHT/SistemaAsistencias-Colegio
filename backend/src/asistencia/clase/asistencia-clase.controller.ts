import {
  BadRequestException, Body, Controller, Get, ParseIntPipe, Post, Query,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { enLima } from '../../common/fecha-lima';
import { RolUsuario, Usuario } from '../../usuarios/usuario.entity';
import { AsistenciaClaseService } from './asistencia-clase.service';
import { GuardarAsistenciaClaseDto } from './dto/guardar-asistencia-clase.dto';

@Roles(RolUsuario.PROFESOR)
@Controller('asistencia/clase')
export class AsistenciaClaseController {
  constructor(private readonly service: AsistenciaClaseService) {}

  @Get()
  listar(
    @CurrentUser() usuario: Usuario,
    @Query('horarioId', ParseIntPipe) horarioId: number,
    @Query('fecha') fecha?: string,
  ) {
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new BadRequestException('fecha debe tener formato YYYY-MM-DD');
    }
    return this.service.listar(horarioId, fecha ?? enLima().fecha, usuario);
  }

  @Post()
  guardar(
    @CurrentUser() usuario: Usuario,
    @Query('horarioId', ParseIntPipe) horarioId: number,
    @Body() dto: GuardarAsistenciaClaseDto,
  ) {
    return this.service.guardar(horarioId, dto, usuario);
  }
}

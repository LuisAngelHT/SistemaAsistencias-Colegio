import { IsEnum } from 'class-validator';
import { EstadoMatricula } from '../matricula.entity';

export class CambiarEstadoDto {
  @IsEnum(EstadoMatricula) estado: EstadoMatricula;
}
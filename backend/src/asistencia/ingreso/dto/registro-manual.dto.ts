import { IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { EstadoAsistencia } from '../../asistencia.enums';

export class RegistroManualDto {
  @IsUUID()
  matriculaId: string;

  @IsEnum(EstadoAsistencia)
  estado: EstadoAsistencia;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener formato YYYY-MM-DD' })
  fecha?: string; // por defecto, hoy

  @IsOptional() @IsString() @MaxLength(500)
  observacion?: string;
}

import { IsIn, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import type { TipoSolicitudJustificacion } from '../solicitud-justificacion.entity';

export class CrearSolicitudJustificacionDto {
  @IsUUID()
  matriculaId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener formato YYYY-MM-DD' })
  fecha: string;

  @IsIn(['falta_justificada', 'tardanza_justificada'])
  tipo: TipoSolicitudJustificacion;

  @IsString()
  @MinLength(3, { message: 'El motivo debe tener al menos 3 caracteres' })
  @MaxLength(500)
  motivo: string;
}

import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RevisarSolicitudJustificacionDto {
  @IsIn(['aprobada', 'rechazada'])
  estado: 'aprobada' | 'rechazada';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacionRevision?: string;
}

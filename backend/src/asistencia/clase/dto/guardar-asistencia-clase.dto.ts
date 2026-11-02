import {
  ArrayMinSize, IsArray, IsDateString, IsIn, IsUUID, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoAsistencia } from '../../asistencia.enums';

class AsistenciaAlumnoDto {
  @IsUUID()
  matriculaId: string;

  @IsIn([EstadoAsistencia.PRESENTE, EstadoAsistencia.FALTA, EstadoAsistencia.EVASION])
  estado: EstadoAsistencia.PRESENTE | EstadoAsistencia.FALTA | EstadoAsistencia.EVASION;
}

export class GuardarAsistenciaClaseDto {
  @IsDateString({ strict: true })
  fecha: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AsistenciaAlumnoDto)
  alumnos: AsistenciaAlumnoDto[];
}

import { IsBoolean, IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { MetodoRegistro } from '../../asistencia.enums';

export class ScanIngresoDto {
  @IsString() @IsNotEmpty() @MaxLength(50)
  codigo: string;

  @IsOptional()
  @IsIn([MetodoRegistro.QR_CAMARA, MetodoRegistro.LECTOR_BARRAS])
  metodo?: MetodoRegistro;

  // Para escaneos hechos sin internet y enviados después
  @IsOptional() @IsBoolean()
  esOffline?: boolean;

  @IsOptional() @IsISO8601()
  horaRegistro?: string; // momento real del escaneo, ej. "2026-10-06T13:02:00Z"
}

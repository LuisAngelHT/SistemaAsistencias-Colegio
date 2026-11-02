import { IsString, Matches } from 'class-validator';

export class AccesoFamiliarDto {
  @IsString()
  @Matches(/^\d{8,15}$/, { message: 'DNI debe tener de 8 a 15 dígitos' })
  dni: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'El código de acceso debe tener 4 dígitos' })
  codigoAcceso: string;
}

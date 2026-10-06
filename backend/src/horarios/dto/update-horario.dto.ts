import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateHorarioDto } from './create-horario.dto';

// La sección de un horario no se cambia (se crea uno nuevo)
export class UpdateHorarioDto extends PartialType(
  OmitType(CreateHorarioDto, ['seccionId'] as const),
) {
  @IsOptional() @IsBoolean()
  activo?: boolean;
}
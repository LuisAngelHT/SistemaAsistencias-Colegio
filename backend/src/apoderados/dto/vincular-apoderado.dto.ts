import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Parentesco } from '../alumno-apoderado.entity';

export class VincularApoderadoDto {
  @IsUUID()
  apoderadoId: string;

  @IsEnum(Parentesco)
  parentesco: Parentesco;

  @IsOptional() @IsBoolean()
  esPrincipal?: boolean;

  @IsOptional() @IsBoolean()
  recibeReportes?: boolean;
}

export class UpdateVinculoDto extends PartialType(
  OmitType(VincularApoderadoDto, ['apoderadoId'] as const),
) {}
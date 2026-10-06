import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateApoderadoDto } from './create-apoderado.dto';

export class UpdateApoderadoDto extends PartialType(CreateApoderadoDto) {
  @IsOptional() @IsBoolean()
  activo?: boolean;
}
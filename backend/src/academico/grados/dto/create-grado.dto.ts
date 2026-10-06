import { IsEnum, IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';
import { NivelEducativo } from '../grado.entity';

export class CreateGradoDto {
  @IsEnum(NivelEducativo)
  nivel: NivelEducativo;

  @IsString() @IsNotEmpty() @MaxLength(50)
  nombre: string; // ej. "1° grado"

  @IsInt() @Min(1)
  orden: number;
}
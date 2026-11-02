import {
  IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength,
} from 'class-validator';

export class CreateSeccionDto {
  @IsInt() anioAcademicoId: number;
  @IsInt() gradoId: number;

  @IsString() @IsNotEmpty() @MaxLength(10)
  nombre: string; // ej. "A"

  @IsOptional() @IsUUID()
  tutorId?: string;

}
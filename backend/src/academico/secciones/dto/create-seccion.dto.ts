import {
  IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, Min,
} from 'class-validator';

export class CreateSeccionDto {
  @IsInt() anioAcademicoId: number;
  @IsInt() gradoId: number;

  @IsString() @IsNotEmpty() @MaxLength(10)
  nombre: string; // ej. "A"

  @IsOptional() @IsUUID()
  tutorId?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, { message: 'horaIngreso debe ser HH:mm' })
  horaIngreso?: string;

  @IsOptional() @IsInt() @Min(0)
  toleranciaMin?: number;
}
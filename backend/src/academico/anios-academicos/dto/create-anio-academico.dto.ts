import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateAnioAcademicoDto {
  @IsString() @IsNotEmpty() @MaxLength(20)
  nombre: string; // ej. "2026"

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaInicio debe tener formato YYYY-MM-DD' })
  fechaInicio: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaFin debe tener formato YYYY-MM-DD' })
  fechaFin: string;
}
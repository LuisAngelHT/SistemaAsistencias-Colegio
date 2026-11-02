import {
  IsNotEmpty, IsOptional, IsString, IsUrl, Length, Matches, MaxLength,
} from 'class-validator';

export class CreateAlumnoDto {
  @IsOptional()
  @Matches(/^[A-Za-z0-9-]{3,20}$/, { message: 'codigo: 3 a 20 letras, números o guiones' })
  codigo?: string;

  @IsString() @Length(8, 15) @Matches(/^\d{8,15}$/)
  dni: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  nombres: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  apellidos: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaNacimiento debe tener formato YYYY-MM-DD' })
  fechaNacimiento?: string;

  @IsOptional() @IsUrl()
  fotoUrl?: string;
}
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsNotEmpty, IsString,
  Length, Matches, MaxLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ImportarAlumnoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  alumno: string;

  @IsString()
  @Length(8, 15)
  @Matches(/^\d{8,15}$/)
  dni: string;

  @IsDateString({ strict: true })
  fechaNacimiento: string;
}

export class ImportarAlumnosDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ImportarAlumnoDto)
  alumnos: ImportarAlumnoDto[];
}

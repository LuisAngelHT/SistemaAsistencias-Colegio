import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCursoDto {
  @IsOptional() @IsString() @MaxLength(20)
  codigo?: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  nombre: string;
}
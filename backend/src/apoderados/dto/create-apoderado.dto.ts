import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateApoderadoDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  nombres: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  apellidos: string;

  @IsOptional() @IsString() @Length(8, 15)
  dni?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString() @Length(6, 20)
  telefono?: string;

  @IsOptional() @IsString() @Length(6, 20)
  whatsapp?: string;
}
import {IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Length, MinLength} from 'class-validator';
import { RolUsuario } from '../usuario.entity.js';

export class CreateUsuarioDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(RolUsuario)
  rol: RolUsuario;

  @IsString()
  @IsNotEmpty()
  nombres: string;

  @IsString()
  @IsNotEmpty()
  apellidos: string;

  @IsOptional()
  @IsString()
  @Length(8, 15)
  dni?: string;

  @IsOptional()
  @IsString()
  @Length(6, 20)
  telefono?: string;
}
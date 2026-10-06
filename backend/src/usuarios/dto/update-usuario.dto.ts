import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateUsuarioDto } from './create-usuario.dto.js';

// El email y la contraseña no se cambian aquí (los gestiona Supabase Auth)
export class UpdateUsuarioDto extends PartialType(
  OmitType(CreateUsuarioDto, ['email', 'password'] as const),
) {}
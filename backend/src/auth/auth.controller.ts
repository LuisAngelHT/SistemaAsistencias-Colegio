// auth.controller.ts
import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator';
import { Usuario } from '../usuarios/usuario.entity';

@Controller('auth')
export class AuthController {
  // El frontend lo usa tras el login para saber el rol y qué pantallas mostrar
  @Get('me')
  me(@CurrentUser() usuario: Usuario) {
    return usuario;
  }
}
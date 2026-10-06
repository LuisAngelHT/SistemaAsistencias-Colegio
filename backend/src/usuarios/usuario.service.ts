import {
  ConflictException, Injectable, InternalServerErrorException, NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { RolUsuario, Usuario } from './usuario.entity';

@Injectable()
export class UsuarioService {
  constructor(
    @InjectRepository(Usuario) private readonly repo: Repository<Usuario>,
    private readonly supabase: SupabaseService,
  ) {}

  async create(dto: CreateUsuarioDto): Promise<Usuario> {
    const { password, email, ...perfil } = dto;
    const emailNorm = email.toLowerCase();

    // 1) Crear la cuenta en Supabase Auth
    const { data, error } = await this.supabase.client.auth.admin.createUser({
      email: emailNorm,
      password,
      email_confirm: true,
    });
    if (error) throw new BadRequestException(error.message);

    // 2) Guardar el perfil; si falla, deshacer la cuenta de Auth
    try {
      const usuario = this.repo.create({
        ...perfil,
        email: emailNorm,
        authUserId: data.user.id,
      });
      return await this.repo.save(usuario);
    } catch (e: any) {
      await this.supabase.client.auth.admin.deleteUser(data.user.id);
      if (e?.code === '23505') {
        throw new ConflictException('Ya existe un usuario con ese email o DNI');
      }
      throw new InternalServerErrorException('No se pudo crear el usuario');
    }
  }

  findAll(rol?: RolUsuario): Promise<Usuario[]> {
    return this.repo.find({
      where: rol ? { rol } : {},
      order: { apellidos: 'ASC', nombres: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Usuario> {
    const usuario = await this.repo.findOne({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  findByAuthId(authUserId: string): Promise<Usuario | null> {
    return this.repo.findOne({ where: { authUserId } });
  }

  async update(id: string, dto: UpdateUsuarioDto): Promise<Usuario> {
    const usuario = await this.findOne(id);
    Object.assign(usuario, dto);
    try {
      return await this.repo.save(usuario);
    } catch (e: any) {
      if (e?.code === '23505') {
        throw new ConflictException('El DNI ya está registrado');
      }
      throw e;
    }
  }

  // Desactiva (no borra) y bloquea el acceso en Supabase Auth
  async desactivar(id: string): Promise<Usuario> {
    const usuario = await this.findOne(id);
    usuario.activo = false;
    if (usuario.authUserId) {
      await this.supabase.client.auth.admin.updateUserById(usuario.authUserId, {
        ban_duration: '876000h',
      });
    }
    return this.repo.save(usuario);
  }

  async activar(id: string): Promise<Usuario> {
    const usuario = await this.findOne(id);
    usuario.activo = true;
    if (usuario.authUserId) {
      await this.supabase.client.auth.admin.updateUserById(usuario.authUserId, {
        ban_duration: 'none',
      });
    }
    return this.repo.save(usuario);
  }
}
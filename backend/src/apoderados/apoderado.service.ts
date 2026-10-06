import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { handleDbError } from '../common/db.errors';
import { Apoderado } from './apoderado.entity';
import { AlumnoApoderado } from './alumno-apoderado.entity';
import { CreateApoderadoDto } from './dto/create-apoderado.dto';
import { UpdateApoderadoDto } from './dto/update-apoderado.dto';
import { UpdateVinculoDto, VincularApoderadoDto } from './dto/vincular-apoderado.dto';

@Injectable()
export class ApoderadoService {
  constructor(
    @InjectRepository(Apoderado) private readonly repo: Repository<Apoderado>,
    @InjectRepository(AlumnoApoderado) private readonly vinculos: Repository<AlumnoApoderado>,
  ) {}

  private validarContacto(a: { email?: string | null; telefono?: string | null; whatsapp?: string | null }) {
    if (!a.email && !a.telefono && !a.whatsapp) {
      throw new BadRequestException('Indica al menos un medio de contacto: email, telefono o whatsapp');
    }
  }

  // ---------- CRUD de apoderados ----------
  async create(dto: CreateApoderadoDto) {
    this.validarContacto(dto);
    try {
      return await this.repo.save(
        this.repo.create({ ...dto, email: dto.email?.toLowerCase() }),
      );
    } catch (e) {
      handleDbError(e, { unique: 'Ya existe un apoderado con ese DNI' });
    }
  }

  findAll(q?: string) {
    const like = q?.trim() ? `%${q.trim()}%` : null;
    return this.repo.find({
      where: like
        ? [{ apellidos: ILike(like) }, { nombres: ILike(like) }, { dni: ILike(like) }]
        : {},
      order: { apellidos: 'ASC', nombres: 'ASC' },
      take: 100,
    });
  }

  async findOne(id: string) {
    const apoderado = await this.repo.findOne({ where: { id } });
    if (!apoderado) throw new NotFoundException('Apoderado no encontrado');
    return apoderado;
  }

  async update(id: string, dto: UpdateApoderadoDto) {
    const apoderado = await this.findOne(id);
    Object.assign(apoderado, dto);
    if (dto.email) apoderado.email = dto.email.toLowerCase();
    this.validarContacto(apoderado);
    try {
      return await this.repo.save(apoderado);
    } catch (e) {
      handleDbError(e, { unique: 'Ya existe un apoderado con ese DNI' });
    }
  }

  async desactivar(id: string) {
    const apoderado = await this.findOne(id);
    apoderado.activo = false;
    return this.repo.save(apoderado);
  }

  // ---------- Vínculo alumno <-> apoderado ----------
  listarDeAlumno(alumnoId: string) {
    return this.vinculos.find({
      where: { alumnoId },
      relations: { apoderado: true },
      order: { esPrincipal: 'DESC' },
    });
  }

  async vincular(alumnoId: string, dto: VincularApoderadoDto) {
    try {
      await this.vinculos.manager.transaction(async (m) => {
        const hayPrincipal =
          (await m.count(AlumnoApoderado, { where: { alumnoId, esPrincipal: true } })) > 0;
        // El primer apoderado de un alumno queda como principal automáticamente
        const esPrincipal = dto.esPrincipal ?? !hayPrincipal;
        if (esPrincipal) {
          await m.update(AlumnoApoderado, { alumnoId }, { esPrincipal: false });
        }
        await m.insert(AlumnoApoderado, {
          alumnoId,
          apoderadoId: dto.apoderadoId,
          parentesco: dto.parentesco,
          esPrincipal,
          recibeReportes: dto.recibeReportes ?? true,
        });
      });
    } catch (e) {
      handleDbError(e, {
        unique: 'Ese apoderado ya está vinculado a este alumno',
        fk: 'El alumno o el apoderado no existe',
      });
    }
    return this.listarDeAlumno(alumnoId);
  }

  async actualizarVinculo(alumnoId: string, apoderadoId: string, dto: UpdateVinculoDto) {
    const vinculo = await this.vinculos.findOne({ where: { alumnoId, apoderadoId } });
    if (!vinculo) throw new NotFoundException('El vínculo no existe');

    await this.vinculos.manager.transaction(async (m) => {
      if (dto.esPrincipal) {
        await m.update(AlumnoApoderado, { alumnoId }, { esPrincipal: false });
      }
      await m.update(AlumnoApoderado, { alumnoId, apoderadoId }, dto);
    });
    return this.listarDeAlumno(alumnoId);
  }

  async desvincular(alumnoId: string, apoderadoId: string) {
    const res = await this.vinculos.delete({ alumnoId, apoderadoId });
    if (!res.affected) throw new NotFoundException('El vínculo no existe');
    return { eliminado: true };
  }
}
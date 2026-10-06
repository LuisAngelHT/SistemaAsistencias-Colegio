import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { ILike, Repository } from 'typeorm';
import { handleDbError } from '../common/db.errors';
import { Alumno } from './alumno.entity';
import { CreateAlumnoDto } from './dto/create-alumno.dto';
import { UpdateAlumnoDto } from './dto/update-alumno.dto';

const MSG_UNICO = 'Ya existe un alumno con ese código o DNI';

@Injectable()
export class AlumnoService {
  constructor(@InjectRepository(Alumno) private readonly repo: Repository<Alumno>) {}

  async create(dto: CreateAlumnoDto) {
    const codigo =
      dto.codigo?.trim().toUpperCase() ?? `AL${randomBytes(4).toString('hex').toUpperCase()}`;
    try {
      return await this.repo.save(this.repo.create({ ...dto, codigo }));
    } catch (e) {
      handleDbError(e, { unique: MSG_UNICO });
    }
  }

  // Búsqueda por nombre, apellido, DNI o código, con paginación
  async findAll(q?: string, page = 1, limit = 20) {
    limit = Math.min(Math.max(limit, 1), 100);
    page = Math.max(page, 1);
    const like = q?.trim() ? `%${q.trim()}%` : null;

    const [data, total] = await this.repo.findAndCount({
      where: like
        ? [
            { apellidos: ILike(like) },
            { nombres: ILike(like) },
            { dni: ILike(like) },
            { codigo: ILike(like) },
          ]
        : {},
      order: { apellidos: 'ASC', nombres: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const alumno = await this.repo.findOne({ where: { id } });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    return alumno;
  }

  // Lo usará el escaneo del QR / código de barras
  async findByCodigo(codigo: string) {
    const alumno = await this.repo.findOne({ where: { codigo: codigo.trim().toUpperCase() } });
    if (!alumno) throw new NotFoundException('Código de alumno no encontrado');
    return alumno;
  }

  async update(id: string, dto: UpdateAlumnoDto) {
    const alumno = await this.findOne(id);
    Object.assign(alumno, dto);
    if (dto.codigo) alumno.codigo = dto.codigo.trim().toUpperCase();
    try {
      return await this.repo.save(alumno);
    } catch (e) {
      handleDbError(e, { unique: MSG_UNICO });
    }
  }

  // No se borra (hay matrículas y asistencias): se desactiva
  async desactivar(id: string) {
    const alumno = await this.findOne(id);
    alumno.activo = false;
    return this.repo.save(alumno);
  }
}
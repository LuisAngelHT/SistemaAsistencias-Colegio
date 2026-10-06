// cursos/curso.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { handleDbError } from '../../common/db.errors';
import { Curso } from './curso.entity';
import { CreateCursoDto } from './dto/create-curso.dto';
import { UpdateCursoDto } from './dto/update-curso.dto';

@Injectable()
export class CursoService {
  constructor(@InjectRepository(Curso) private readonly repo: Repository<Curso>) {}

  async create(dto: CreateCursoDto) {
    try {
      return await this.repo.save(this.repo.create(dto));
    } catch (e) {
      handleDbError(e, { unique: 'Ya existe un curso con ese nombre o código' });
    }
  }

  findAll(soloActivos = false) {
    return this.repo.find({
      where: soloActivos ? { activo: true } : {},
      order: { nombre: 'ASC' },
    });
  }

  async findOne(id: number) {
    const curso = await this.repo.findOne({ where: { id } });
    if (!curso) throw new NotFoundException('Curso no encontrado');
    return curso;
  }

  async update(id: number, dto: UpdateCursoDto) {
    const curso = await this.findOne(id);
    Object.assign(curso, dto);
    try {
      return await this.repo.save(curso);
    } catch (e) {
      handleDbError(e, { unique: 'Ya existe un curso con ese nombre o código' });
    }
  }

  async remove(id: number) {
    await this.findOne(id);
    try {
      await this.repo.delete(id);
      return { eliminado: true };
    } catch (e) {
      handleDbError(e, { fk: 'No se puede eliminar: el curso está en horarios. Desactívalo con PATCH' });
    }
  }
}
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { handleDbError } from '../../common/db.errors';
import { Grado, NivelEducativo } from './grado.entity';
import { CreateGradoDto } from './dto/create-grado.dto';
import { UpdateGradoDto } from './dto/update-grado.dto';

@Injectable()
export class GradoService {
  constructor(@InjectRepository(Grado) private readonly repo: Repository<Grado>) {}

  async create(dto: CreateGradoDto) {
    try {
      return await this.repo.save(this.repo.create(dto));
    } catch (e) {
      handleDbError(e, { unique: 'Ya existe un grado con ese nombre u orden en el nivel' });
    }
  }

  findAll(nivel?: NivelEducativo) {
    return this.repo.find({
      where: nivel ? { nivel } : {},
      order: { nivel: 'ASC', orden: 'ASC' },
    });
  }

  async findOne(id: number) {
    const grado = await this.repo.findOne({ where: { id } });
    if (!grado) throw new NotFoundException('Grado no encontrado');
    return grado;
  }

  async update(id: number, dto: UpdateGradoDto) {
    const grado = await this.findOne(id);
    Object.assign(grado, dto);
    try {
      return await this.repo.save(grado);
    } catch (e) {
      handleDbError(e, { unique: 'Ya existe un grado con ese nombre u orden en el nivel' });
    }
  }

  async remove(id: number) {
    await this.findOne(id);
    try {
      await this.repo.delete(id);
      return { eliminado: true };
    } catch (e) {
      handleDbError(e, { fk: 'No se puede eliminar: el grado tiene secciones' });
    }
  }
}
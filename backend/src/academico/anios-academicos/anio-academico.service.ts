// anios-academicos/anio-academico.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { handleDbError } from '../../common/db.errors';
import { AnioAcademico } from './anio-academico.entity';
import { CreateAnioAcademicoDto } from './dto/create-anio-academico.dto';
import { UpdateAnioAcademicoDto } from './dto/update-anio-academico.dto';

@Injectable()
export class AnioAcademicoService {
  constructor(
    @InjectRepository(AnioAcademico) private readonly repo: Repository<AnioAcademico>,
  ) {}

  private validarFechas(inicio: string, fin: string) {
    if (fin <= inicio) {
      throw new BadRequestException('La fecha de fin debe ser posterior a la de inicio');
    }
  }

  async create(dto: CreateAnioAcademicoDto) {
    this.validarFechas(dto.fechaInicio, dto.fechaFin);
    try {
      return await this.repo.save(this.repo.create(dto));
    } catch (e) {
      handleDbError(e, { unique: 'Ya existe un año académico con ese nombre' });
    }
  }

  findAll() {
    return this.repo.find({ order: { fechaInicio: 'DESC' } });
  }

  findActivo() {
    return this.repo.findOne({ where: { activo: true } });
  }

  async findOne(id: number) {
    const anio = await this.repo.findOne({ where: { id } });
    if (!anio) throw new NotFoundException('Año académico no encontrado');
    return anio;
  }

  async update(id: number, dto: UpdateAnioAcademicoDto) {
    const anio = await this.findOne(id);
    Object.assign(anio, dto);
    this.validarFechas(anio.fechaInicio, anio.fechaFin);
    try {
      return await this.repo.save(anio);
    } catch (e) {
      handleDbError(e, { unique: 'Ya existe un año académico con ese nombre' });
    }
  }

  // Solo puede haber un año activo: se desactivan los demás y se activa este
  async activar(id: number) {
    await this.findOne(id);
    await this.repo.manager.transaction(async (m) => {
      await m.update(AnioAcademico, { activo: true }, { activo: false });
      await m.update(AnioAcademico, { id }, { activo: true });
    });
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    try {
      await this.repo.delete(id);
      return { eliminado: true };
    } catch (e) {
      handleDbError(e, { fk: 'No se puede eliminar: el año tiene secciones o matrículas' });
    }
  }
}
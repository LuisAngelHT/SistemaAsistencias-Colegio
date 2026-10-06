import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { handleDbError } from '../../common/db.errors';
import { RolUsuario } from '../../usuarios/usuario.entity';
import { UsuarioService } from '../../usuarios/usuario.service';
import { AnioAcademico } from '../anios-academicos/anio-academico.entity';
import { Seccion } from './seccion.entity';
import { CreateSeccionDto } from './dto/create-seccion.dto';
import { UpdateSeccionDto } from './dto/update-seccion.dto';

@Injectable()
export class SeccionService {
  constructor(
    @InjectRepository(Seccion) private readonly repo: Repository<Seccion>,
    @InjectRepository(AnioAcademico) private readonly anioRepo: Repository<AnioAcademico>,
    private readonly usuarios: UsuarioService,
  ) {}

  private async validarTutor(tutorId: string) {
    const tutor = await this.usuarios.findOne(tutorId);
    if (tutor.rol !== RolUsuario.PROFESOR || !tutor.activo) {
      throw new BadRequestException('El tutor debe ser un profesor activo');
    }
  }

  async create(dto: CreateSeccionDto) {
    if (dto.tutorId) await this.validarTutor(dto.tutorId);
    try {
      const saved = await this.repo.save(this.repo.create(dto));
      return this.findOne(saved.id);
    } catch (e) {
      handleDbError(e, {
        unique: 'Ya existe esa sección en ese grado y año académico',
        fk: 'El año académico o el grado no existe',
      });
    }
  }

  // Si no se indica anioId, usa el año académico activo
  async findAll(filtros: { anioId?: number; gradoId?: number }) {
    let anioId = filtros.anioId;
    if (!anioId) {
      const activo = await this.anioRepo.findOne({ where: { activo: true } });
      anioId = activo?.id;
    }
    return this.repo.find({
      where: {
        ...(anioId && { anioAcademicoId: anioId }),
        ...(filtros.gradoId && { gradoId: filtros.gradoId }),
      },
      relations: { grado: true, tutor: true },
      order: { grado: { nivel: 'ASC', orden: 'ASC' }, nombre: 'ASC' },
    });
  }

  async findOne(id: number) {
    const seccion = await this.repo.findOne({
      where: { id },
      relations: { grado: true, tutor: true, anioAcademico: true },
    });
    if (!seccion) throw new NotFoundException('Sección no encontrada');
    return seccion;
  }

  async update(id: number, dto: UpdateSeccionDto) {
    await this.findOne(id);
    if (dto.tutorId) await this.validarTutor(dto.tutorId);
    try {
      await this.repo.update(id, dto);
    } catch (e) {
      handleDbError(e, {
        unique: 'Ya existe esa sección en ese grado y año académico',
        fk: 'El grado no existe',
      });
    }
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    try {
      await this.repo.delete(id);
      return { eliminado: true };
    } catch (e) {
      handleDbError(e, { fk: 'No se puede eliminar: la sección tiene alumnos matriculados' });
    }
  }
}
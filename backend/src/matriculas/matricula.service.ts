import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeccionService } from '../academico/secciones/seccion.service';
import { AlumnoService } from '../alumnos/alumno.service';
import { handleDbError } from '../common/db.errors';
import { EstadoMatricula, Matricula } from './matricula.entity';
import { CreateMatriculaDto } from './dto/create-matricula.dto';

@Injectable()
export class MatriculaService {
  constructor(
    @InjectRepository(Matricula) private readonly repo: Repository<Matricula>,
    private readonly alumnos: AlumnoService,
    private readonly secciones: SeccionService,
  ) {}

  async create(dto: CreateMatriculaDto) {
    const alumno = await this.alumnos.findOne(dto.alumnoId);
    if (!alumno.activo) throw new BadRequestException('El alumno está inactivo');
    const seccion = await this.secciones.findOne(dto.seccionId);

    try {
      const saved = await this.repo.save(
        this.repo.create({
          alumnoId: alumno.id,
          seccionId: seccion.id,
          anioAcademicoId: seccion.anioAcademicoId, // el año sale de la sección
        }),
      );
      return this.findOne(saved.id);
    } catch (e) {
      handleDbError(e, { unique: 'El alumno ya está matriculado en ese año académico' });
    }
  }

  // Relación de alumnos de una sección (para auxiliar y profesor) o historial de un alumno
  findAll(f: { seccionId?: number; alumnoId?: string; estado?: EstadoMatricula }) {
    if (!f.seccionId && !f.alumnoId) {
      throw new BadRequestException('Indica seccionId o alumnoId');
    }
    const estado = f.estado ?? (f.seccionId ? EstadoMatricula.ACTIVA : undefined);
    return this.repo.find({
      where: {
        ...(f.seccionId && { seccionId: f.seccionId }),
        ...(f.alumnoId && { alumnoId: f.alumnoId }),
        ...(estado && { estado }),
      },
      relations: { alumno: true, seccion: { grado: true } },
      order: { alumno: { apellidos: 'ASC', nombres: 'ASC' } },
    });
  }

  async findOne(id: string) {
    const matricula = await this.repo.findOne({
      where: { id },
      relations: { alumno: true, seccion: { grado: true } },
    });
    if (!matricula) throw new NotFoundException('Matrícula no encontrada');
    return matricula;
  }

  async cambiarSeccion(id: string, seccionId: number) {
    const matricula = await this.findOne(id);
    if (matricula.estado !== EstadoMatricula.ACTIVA) {
      throw new BadRequestException('Solo se puede cambiar de sección una matrícula activa');
    }
    const seccion = await this.secciones.findOne(seccionId);
    if (seccion.anioAcademicoId !== matricula.anioAcademicoId) {
      throw new BadRequestException('La nueva sección debe ser del mismo año académico');
    }
    await this.repo.update(id, { seccionId });
    return this.findOne(id);
  }

  async cambiarEstado(id: string, estado: EstadoMatricula) {
    await this.findOne(id);
    await this.repo.update(id, { estado });
    return this.findOne(id);
  }
}
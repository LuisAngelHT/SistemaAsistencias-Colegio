import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CursoService } from '../academico/cursos/curso.service';
import { SeccionService } from '../academico/secciones/seccion.service';
import { handleDbError } from '../common/db.errors';
import { RolUsuario } from '../usuarios/usuario.entity';
import { UsuarioService } from '../usuarios/usuario.service';
import { Horario } from './horario.entity';
import { CreateHorarioDto } from './dto/create-horario.dto';
import { UpdateHorarioDto } from './dto/update-horario.dto';

const norm = (t: string) => (t.length === 5 ? `${t}:00` : t); // "08:00" -> "08:00:00"

interface Franja {
  seccionId: number;
  profesorId: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

@Injectable()
export class HorarioService {
  constructor(
    @InjectRepository(Horario) private readonly repo: Repository<Horario>,
    private readonly secciones: SeccionService,
    private readonly cursos: CursoService,
    private readonly usuarios: UsuarioService,
  ) {}

  private async validarProfesor(id: string) {
    const profesor = await this.usuarios.findOne(id);
    if (profesor.rol !== RolUsuario.PROFESOR || !profesor.activo) {
      throw new BadRequestException('El profesor debe ser un usuario activo con rol profesor');
    }
  }

  private async validarCurso(id: number) {
    const curso = await this.cursos.findOne(id);
    if (!curso.activo) throw new BadRequestException('El curso está inactivo');
  }

  private validarHoras(inicio: string, fin: string) {
    if (fin <= inicio) {
      throw new BadRequestException('La hora de fin debe ser posterior a la de inicio');
    }
  }

  // Una sección no puede tener 2 clases a la vez; un profesor tampoco (en el mismo año)
  private async validarSolapes(f: Franja, anioId: number, excluirId?: number) {
    const qb = this.repo
      .createQueryBuilder('h')
      .innerJoin('h.seccion', 's')
      .where('h.activo = true')
      .andWhere('h.diaSemana = :dia', { dia: f.diaSemana })
      .andWhere('h.horaInicio < :fin AND h.horaFin > :inicio', {
        inicio: f.horaInicio,
        fin: f.horaFin,
      })
      .andWhere(
        '(h.seccionId = :seccionId OR (h.profesorId = :profesorId AND s.anioAcademicoId = :anioId))',
        { seccionId: f.seccionId, profesorId: f.profesorId, anioId },
      );
    if (excluirId) qb.andWhere('h.id != :excluirId', { excluirId });

    if (await qb.getOne()) {
      throw new ConflictException(
        'Choque de horario: la sección o el profesor ya tienen una clase en ese rango',
      );
    }
  }

  async create(dto: CreateHorarioDto) {
    const seccion = await this.secciones.findOne(dto.seccionId);
    await this.validarProfesor(dto.profesorId);
    await this.validarCurso(dto.cursoId);

    const horaInicio = norm(dto.horaInicio);
    const horaFin = norm(dto.horaFin);
    this.validarHoras(horaInicio, horaFin);
    await this.validarSolapes({ ...dto, horaInicio, horaFin }, seccion.anioAcademicoId);

    try {
      const saved = await this.repo.save(this.repo.create({ ...dto, horaInicio, horaFin }));
      return this.findOne(saved.id);
    } catch (e) {
      handleDbError(e, {
        unique: 'La sección ya tiene una clase con esa hora de inicio ese día',
        fk: 'La sección, el curso o el profesor no existe',
      });
    }
  }

  findAll(f: { seccionId?: number; profesorId?: string; diaSemana?: number }) {
    return this.repo.find({
      where: {
        ...(f.seccionId && { seccionId: f.seccionId }),
        ...(f.profesorId && { profesorId: f.profesorId }),
        ...(f.diaSemana && { diaSemana: f.diaSemana }),
      },
      relations: { seccion: { grado: true }, curso: true, profesor: true },
      order: { diaSemana: 'ASC', horaInicio: 'ASC' },
    });
  }

  // Clases del profesor en el año académico activo
  misHorarios(profesorId: string, diaSemana?: number) {
    return this.repo.find({
      where: {
        profesorId,
        activo: true,
        ...(diaSemana && { diaSemana }),
        seccion: { anioAcademico: { activo: true } },
      },
      relations: { seccion: { grado: true }, curso: true },
      order: { diaSemana: 'ASC', horaInicio: 'ASC' },
    });
  }

  // ¿El profesor dicta clase en esa sección (o es su tutor)? Para restringir lo que puede ver
  async profesorTieneSeccion(profesorId: string, seccionId: number): Promise<boolean> {
    const seccion = await this.secciones.findOne(seccionId);
    if (seccion.tutorId === profesorId) return true;
    const n = await this.repo.count({
      where: { profesorId, seccionId, activo: true },
    });
    return n > 0;
  }

  async findOne(id: number) {
    const horario = await this.repo.findOne({
      where: { id },
      relations: { seccion: { grado: true }, curso: true, profesor: true },
    });
    if (!horario) throw new NotFoundException('Horario no encontrado');
    return horario;
  }

  async update(id: number, dto: UpdateHorarioDto) {
    const actual = await this.findOne(id);
    if (dto.profesorId) await this.validarProfesor(dto.profesorId);
    if (dto.cursoId) await this.validarCurso(dto.cursoId);

    const franja: Franja = {
      seccionId: actual.seccionId,
      profesorId: dto.profesorId ?? actual.profesorId,
      diaSemana: dto.diaSemana ?? actual.diaSemana,
      horaInicio: norm(dto.horaInicio ?? actual.horaInicio),
      horaFin: norm(dto.horaFin ?? actual.horaFin),
    };
    this.validarHoras(franja.horaInicio, franja.horaFin);
    if (dto.activo ?? actual.activo) {
      await this.validarSolapes(franja, actual.seccion.anioAcademicoId, id);
    }

    try {
      await this.repo.update(id, {
        ...dto,
        horaInicio: franja.horaInicio,
        horaFin: franja.horaFin,
      });
    } catch (e) {
      handleDbError(e, { unique: 'La sección ya tiene una clase con esa hora de inicio ese día' });
    }
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    try {
      await this.repo.delete(id);
      return { eliminado: true };
    } catch (e) {
      handleDbError(e, {
        fk: 'El horario ya tiene asistencias registradas. Desactívalo con PATCH {"activo": false}',
      });
    }
  }
}
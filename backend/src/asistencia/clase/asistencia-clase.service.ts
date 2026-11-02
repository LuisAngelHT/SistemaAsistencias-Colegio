import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { enLima } from '../../common/fecha-lima';
import { EstadoMatricula } from '../../matriculas/matricula.entity';
import { MatriculaService } from '../../matriculas/matricula.service';
import { Usuario } from '../../usuarios/usuario.entity';
import { HorarioService } from '../../horarios/horario.service';
import { EstadoAsistencia } from '../asistencia.enums';
import { AsistenciaClase } from './asistencia-clase.entity';
import { GuardarAsistenciaClaseDto } from './dto/guardar-asistencia-clase.dto';

@Injectable()
export class AsistenciaClaseService {
  constructor(
    @InjectRepository(AsistenciaClase) private readonly repo: Repository<AsistenciaClase>,
    private readonly horarios: HorarioService,
    private readonly matriculas: MatriculaService,
  ) {}

  private async validarHorario(horarioId: number, usuario: Usuario) {
    const horario = await this.horarios.findOne(horarioId);
    if (horario.profesorId !== usuario.id || !horario.activo) {
      throw new ForbiddenException('Solo puedes pasar lista en tus horarios activos');
    }
    if (!horario.seccion.anioAcademico.activo) {
      throw new BadRequestException('El horario no pertenece al año académico activo');
    }
    return horario;
  }

  private validarFecha(fecha: string) {
    const parsed = new Date(`${fecha}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || enLima(parsed).fecha !== fecha) {
      throw new BadRequestException('La fecha de asistencia no es válida');
    }
    if (fecha !== enLima().fecha) {
      throw new ForbiddenException('El profesor solo puede registrar asistencia del día actual');
    }
  }

  async listar(horarioId: number, fecha: string, usuario: Usuario) {
    const horario = await this.validarHorario(horarioId, usuario);
    this.validarFecha(fecha);
    const matriculas = await this.matriculas.findAll({ seccionId: horario.seccionId });
    const registros = matriculas.length
      ? await this.repo.find({
          where: {
            horarioId,
            fecha,
            matriculaId: In(matriculas.map((matricula) => matricula.id)),
          },
        })
      : [];
    const porMatricula = new Map(registros.map((registro) => [registro.matriculaId, registro]));

    return {
      horarioId,
      fecha,
      curso: horario.curso.nombre,
      seccion: {
        id: horario.seccion.id,
        nombre: horario.seccion.nombre,
        grado: horario.seccion.grado.nombre,
        nivel: horario.seccion.grado.nivel,
      },
      alumnos: matriculas
        .filter((matricula) => matricula.estado === EstadoMatricula.ACTIVA && matricula.alumno.activo)
        .map((matricula) => {
          const registro = porMatricula.get(matricula.id);
          return {
            matriculaId: matricula.id,
            alumno: {
              id: matricula.alumno.id,
              codigo: matricula.alumno.codigo,
              nombres: matricula.alumno.nombres,
              apellidos: matricula.alumno.apellidos,
              fotoUrl: matricula.alumno.fotoUrl,
            },
            estado: registro?.estado === EstadoAsistencia.FALTA
              ? EstadoAsistencia.EVASION
              : registro?.estado ?? null,
          };
        }),
    };
  }

  async guardar(horarioId: number, dto: GuardarAsistenciaClaseDto, usuario: Usuario) {
    const horario = await this.validarHorario(horarioId, usuario);
    this.validarFecha(dto.fecha);

    const ids = dto.alumnos.map((alumno) => alumno.matriculaId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('No se puede repetir un alumno en la lista');
    }

    const matriculas = await this.matriculas.findAll({ seccionId: horario.seccionId });
    const validas = new Set(
      matriculas
        .filter((matricula) =>
          matricula.estado === EstadoMatricula.ACTIVA && matricula.alumno.activo,
        )
        .map((matricula) => matricula.id),
    );
    if (ids.some((id) => !validas.has(id))) {
      throw new BadRequestException('La lista incluye matrículas que no pertenecen a esta sección');
    }

    await this.repo.upsert(
      dto.alumnos.map((alumno) => ({
        horarioId,
        matriculaId: alumno.matriculaId,
        fecha: dto.fecha,
        estado: alumno.estado === EstadoAsistencia.FALTA
          ? EstadoAsistencia.EVASION
          : alumno.estado,
        registradoPor: usuario.id,
      })),
      ['horarioId', 'matriculaId', 'fecha'],
    );
    return this.listar(horarioId, dto.fecha, usuario);
  }
}

import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AlumnoService } from '../../alumnos/alumno.service';
import { aSegundos, enLima } from '../../common/fecha-lima';
import { Matricula } from '../../matriculas/matricula.entity';
import { MatriculaService } from '../../matriculas/matricula.service';
import { RolUsuario, Usuario } from '../../usuarios/usuario.entity';
import { EstadoAsistencia, MetodoRegistro } from '../asistencia.enums';
import { AsistenciaIngreso } from './asistencia-ingreso.entity';
import { RegistroManualDto } from './dto/registro-manual.dto';
import { ScanIngresoDto } from './dto/scan-ingreso.dto';

const MENSAJES: Partial<Record<EstadoAsistencia, string>> = {
  [EstadoAsistencia.PRESENTE]: 'Ingreso correcto',
  [EstadoAsistencia.TARDANZA]: 'Ingreso con tardanza',
};

@Injectable()
export class AsistenciaIngresoService {
  constructor(
    @InjectRepository(AsistenciaIngreso) private readonly repo: Repository<AsistenciaIngreso>,
    private readonly alumnos: AlumnoService,
    private readonly matriculas: MatriculaService,
  ) {}

  // ---------- Escaneo QR / código de barras ----------
  async scan(dto: ScanIngresoDto, usuario: Usuario) {
    const ahora = new Date();
    const momento = dto.horaRegistro ? new Date(dto.horaRegistro) : ahora;
    if (momento.getTime() > ahora.getTime() + 5 * 60 * 1000) {
      throw new BadRequestException('La hora de registro no puede estar en el futuro');
    }

    const alumno = await this.alumnos.findByCodigo(dto.codigo);
    if (!alumno.activo) throw new BadRequestException('El alumno está inactivo');

    const matricula = await this.matriculas.findActivaDeAlumno(alumno.id);
    if (!matricula) {
      throw new BadRequestException('El alumno no tiene matrícula activa en el año académico vigente');
    }

    // Presente hasta horaIngreso + tolerancia; después, tardanza
    const { fecha, hora } = enLima(momento);
    const { horaIngreso, toleranciaMin } = matricula.seccion;
    const limite = aSegundos(horaIngreso) + toleranciaMin * 60;
    const estado =
      aSegundos(hora) <= limite ? EstadoAsistencia.PRESENTE : EstadoAsistencia.TARDANZA;

    try {
      const registro = await this.repo.save(
        this.repo.create({
          matriculaId: matricula.id,
          fecha,
          horaRegistro: momento,
          estado,
          metodo: dto.metodo ?? MetodoRegistro.QR_CAMARA,
          registradoPor: usuario.id,
          esOffline: dto.esOffline ?? false,
        }),
      );
      return this.respuesta('registrado', registro, matricula);
    } catch (e: any) {
      if (e?.code === '23505') {
        // Ya existe el registro de ese día: se devuelve el original
        const previo = await this.repo.findOneOrFail({
          where: { matriculaId: matricula.id, fecha },
        });
        return this.respuesta('ya_registrado', previo, matricula);
      }
      throw e;
    }
  }

  private respuesta(
    resultado: 'registrado' | 'ya_registrado',
    r: AsistenciaIngreso,
    m: Matricula,
  ) {
    const hora = enLima(r.horaRegistro).hora.slice(0, 5);
    return {
      resultado,
      mensaje:
        resultado === 'ya_registrado'
          ? `Ya registró su ingreso a las ${hora}`
          : (MENSAJES[r.estado] ?? 'Ingreso registrado'),
      estado: r.estado,
      fecha: r.fecha,
      hora,
      alumno: {
        id: m.alumno.id,
        codigo: m.alumno.codigo,
        nombres: m.alumno.nombres,
        apellidos: m.alumno.apellidos,
        fotoUrl: m.alumno.fotoUrl,
      },
      seccion: `${m.seccion.grado.nivel} ${m.seccion.grado.nombre} "${m.seccion.nombre}"`,
    };
  }

  // ---------- Registro o corrección manual ----------
  async registrarManual(dto: RegistroManualDto, usuario: Usuario) {
    await this.matriculas.findOne(dto.matriculaId); // 404 si no existe

    const hoy = enLima().fecha;
    const fecha = dto.fecha ?? hoy;
    if (fecha !== hoy && usuario.rol !== RolUsuario.DIRECTOR) {
      throw new ForbiddenException('Solo el director puede registrar asistencia de otras fechas');
    }

    const existente = await this.repo.findOne({
      where: { matriculaId: dto.matriculaId, fecha },
    });
    const registro = existente ?? this.repo.create({ matriculaId: dto.matriculaId, fecha });
    Object.assign(registro, {
      estado: dto.estado,
      metodo: MetodoRegistro.MANUAL,
      registradoPor: usuario.id,
      horaRegistro: new Date(),
      observacion: dto.observacion ?? registro.observacion ?? null,
    });
    return this.repo.save(registro);
  }

  // ---------- Lista de una sección en una fecha ----------
  async listarSeccion(seccionId: number, fecha = enLima().fecha) {
    const matriculas = await this.matriculas.findAll({ seccionId });
    const registros = matriculas.length
      ? await this.repo.find({ where: { fecha, matriculaId: In(matriculas.map((m) => m.id)) } })
      : [];
    const porMatricula = new Map(registros.map((r) => [r.matriculaId, r]));

    const alumnos = matriculas.map((m) => {
      const r = porMatricula.get(m.id);
      return {
        matriculaId: m.id,
        alumno: {
          id: m.alumno.id,
          codigo: m.alumno.codigo,
          nombres: m.alumno.nombres,
          apellidos: m.alumno.apellidos,
          fotoUrl: m.alumno.fotoUrl,
        },
        estado: r?.estado ?? null,
        hora: r ? enLima(r.horaRegistro).hora.slice(0, 5) : null,
        metodo: r?.metodo ?? null,
        observacion: r?.observacion ?? null,
      };
    });

    return {
      fecha,
      seccionId,
      total: alumnos.length,
      presentes: alumnos.filter((a) => a.estado === EstadoAsistencia.PRESENTE).length,
      tardanzas: alumnos.filter((a) => a.estado === EstadoAsistencia.TARDANZA).length,
      sinRegistrar: alumnos.filter((a) => !a.estado).length,
      alumnos,
    };
  }
}

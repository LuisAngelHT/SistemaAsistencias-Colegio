import {
  BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException,
  OnModuleDestroy, OnModuleInit,
} from '@nestjs/common';
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
import { ConfiguracionIngreso } from './configuracion-ingreso.entity';
import { ConfigurarIngresoDto } from './dto/configurar-ingreso.dto';

const MENSAJES: Partial<Record<EstadoAsistencia, string>> = {
  [EstadoAsistencia.PRESENTE]: 'Ingreso correcto',
  [EstadoAsistencia.TARDANZA]: 'Ingreso con tardanza',
};

@Injectable()
export class AsistenciaIngresoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AsistenciaIngresoService.name);
  private autoFaltaTimer: NodeJS.Timeout | undefined;
  private procesandoFaltas = false;

  constructor(
    @InjectRepository(AsistenciaIngreso) private readonly repo: Repository<AsistenciaIngreso>,
    @InjectRepository(ConfiguracionIngreso)
    private readonly configuracionRepo: Repository<ConfiguracionIngreso>,
    private readonly alumnos: AlumnoService,
    private readonly matriculas: MatriculaService,
  ) {}

  onModuleInit() {
    void this.marcarFaltasAutomaticamente();
    this.autoFaltaTimer = setInterval(() => {
      void this.marcarFaltasAutomaticamente();
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.autoFaltaTimer) clearInterval(this.autoFaltaTimer);
  }

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

    // Presente hasta la tolerancia; toda llegada posterior se registra tardía.
    const { fecha, hora } = enLima(momento);
    const { horaIngreso, toleranciaMin } = await this.obtenerConfiguracion();
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
        // Si previamente se marcó falta, el escaneo posterior confirma el ingreso real.
        const previo = await this.repo.findOneOrFail({
          where: { matriculaId: matricula.id, fecha },
        });
        if (previo.estado === EstadoAsistencia.FALTA) {
          previo.estado = estado;
          previo.horaRegistro = momento;
          previo.metodo = dto.metodo ?? MetodoRegistro.QR_CAMARA;
          previo.registradoPor = usuario.id;
          previo.esOffline = dto.esOffline ?? false;
          const actualizado = await this.repo.save(previo);
          return this.respuesta('registrado', actualizado, matricula);
        }
        return this.respuesta('ya_registrado', previo, matricula);
      }
      throw e;
    }
  }

  async obtenerConfiguracion() {
    const configuracion = await this.configuracionRepo.findOne({ where: { id: 1 } });
    if (!configuracion) {
      throw new NotFoundException(
        'No existe la configuración general de ingreso. Ejecuta la migración configuracion-horario-ingreso.sql.',
      );
    }
    return configuracion;
  }

  async actualizarConfiguracion(dto: ConfigurarIngresoDto) {
    const finTolerancia = aSegundos(dto.horaIngreso) + dto.toleranciaMin * 60;
    if (aSegundos(dto.horaLimite) <= finTolerancia) {
      throw new BadRequestException(
        'La hora límite debe ser posterior al fin de la tolerancia.',
      );
    }
    const configuracion = await this.obtenerConfiguracion();
    configuracion.horaIngreso = dto.horaIngreso;
    configuracion.toleranciaMin = dto.toleranciaMin;
    configuracion.horaLimite = dto.horaLimite;
    const guardada = await this.configuracionRepo.save(configuracion);
    await this.marcarFaltasAutomaticamente();
    return guardada;
  }

  private async marcarFaltasAutomaticamente(propagateError = false) {
    if (this.procesandoFaltas) return;
    this.procesandoFaltas = true;
    try {
      const { fecha, hora } = enLima();
      const configuracion = await this.obtenerConfiguracion();
      if (aSegundos(hora) < aSegundos(configuracion.horaLimite)) return;

      await this.repo.manager.query(`
        INSERT INTO public.asistencia_ingreso
          (matricula_id, fecha, estado, observacion)
        SELECT m.id, $1::date, 'falta', $2
        FROM public.matriculas m
        JOIN public.alumnos a ON a.id = m.alumno_id AND a.activo = true
        JOIN public.anios_academicos aa
          ON aa.id = m.anio_academico_id AND aa.activo = true
        WHERE m.estado = 'activa'
          AND NOT EXISTS (
            SELECT 1
            FROM public.asistencia_ingreso ai
            WHERE ai.matricula_id = m.id AND ai.fecha = $1::date
          )
        ON CONFLICT DO NOTHING
      `, [
        fecha,
        'Falta registrada automáticamente al llegar la hora límite de ingreso.',
      ]);
    } catch (error) {
      this.logger.error(
        'No se pudieron registrar automáticamente las faltas de ingreso.',
        error instanceof Error ? error.stack : String(error),
      );
      if (propagateError) throw error;
    } finally {
      this.procesandoFaltas = false;
    }
  }

  private respuesta(
    resultado: 'registrado' | 'ya_registrado',
    r: AsistenciaIngreso,
    m: Matricula,
  ) {
    const hora = r.horaRegistro ? enLima(r.horaRegistro).hora.slice(0, 5) : null;
    const mensaje = resultado === 'ya_registrado'
      ? hora
        ? `Ya registró su ingreso a las ${hora}`
        : 'Ya cuenta con un registro de asistencia para hoy'
      : MENSAJES[r.estado] ?? 'Ingreso registrado';
    return {
      resultado,
      mensaje,
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
    if (fecha === hoy && usuario.rol === RolUsuario.AUXILIAR) {
      const { hora } = enLima();
      const configuracion = await this.obtenerConfiguracion();
      const segundosAhora = aSegundos(hora);
      const finTolerancia = aSegundos(configuracion.horaIngreso) + configuracion.toleranciaMin * 60;
      if (
        dto.estado === EstadoAsistencia.PRESENTE
        && segundosAhora > finTolerancia
      ) {
        throw new BadRequestException('La tolerancia terminó; registra al alumno como tardanza.');
      }
      if (dto.estado === EstadoAsistencia.TARDANZA && segundosAhora <= finTolerancia) {
        throw new BadRequestException('Aún está vigente el horario de ingreso puntual.');
      }
      if (
        dto.estado === EstadoAsistencia.FALTA
        && segundosAhora < aSegundos(configuracion.horaLimite)
      ) {
        throw new BadRequestException('La falta se registra automáticamente al llegar la hora límite.');
      }
    }

    const existente = await this.repo.findOne({
      where: { matriculaId: dto.matriculaId, fecha },
    });
    if (
      dto.estado === EstadoAsistencia.FALTA
      && (existente?.estado === EstadoAsistencia.PRESENTE || existente?.estado === EstadoAsistencia.TARDANZA)
    ) {
      throw new BadRequestException(
        'El alumno ya registró su ingreso. Corrige el estado a presente o tardanza, no a falta.',
      );
    }
    if (dto.estado === EstadoAsistencia.TARDANZA && existente?.estado === EstadoAsistencia.PRESENTE) {
      throw new BadRequestException('El alumno ya está registrado como presente y no se puede cambiar a tardanza.');
    }
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
    if (fecha === enLima().fecha) await this.marcarFaltasAutomaticamente(true);
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
        hora: r?.horaRegistro ? enLima(r.horaRegistro).hora.slice(0, 5) : null,
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
      faltas: alumnos.filter((a) => a.estado === EstadoAsistencia.FALTA).length,
      justificadas: alumnos.filter((a) =>
        a.estado === EstadoAsistencia.FALTA_JUSTIFICADA
        || a.estado === EstadoAsistencia.TARDANZA_JUSTIFICADA,
      ).length,
      sinRegistrar: alumnos.filter((a) => !a.estado).length,
      alumnos,
    };
  }
}

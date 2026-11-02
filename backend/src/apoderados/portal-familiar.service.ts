import {
  BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { createHmac, createHash, scryptSync, timingSafeEqual } from 'crypto';
import { enLima } from '../common/fecha-lima';
import { EstadoAsistencia, MetodoRegistro } from '../asistencia/asistencia.enums';
import { AsistenciaIngreso } from '../asistencia/ingreso/asistencia-ingreso.entity';
import { AsistenciaClase } from '../asistencia/clase/asistencia-clase.entity';
import { EstadoMatricula, Matricula } from '../matriculas/matricula.entity';
import { Alumno } from '../alumnos/alumno.entity';
import { AccesoFamiliarDto } from './dto/acceso-familiar.dto';
import { CrearSolicitudJustificacionDto } from './dto/crear-solicitud-justificacion.dto';
import { RevisarSolicitudJustificacionDto } from './dto/revisar-solicitud-justificacion.dto';
import { EstadoSolicitudJustificacion, SolicitudJustificacion } from './solicitud-justificacion.entity';

@Injectable()
export class PortalFamiliarService {
  constructor(
    @InjectRepository(Matricula) private readonly matriculas: Repository<Matricula>,
    @InjectRepository(AsistenciaIngreso) private readonly asistencias: Repository<AsistenciaIngreso>,
    @InjectRepository(AsistenciaClase) private readonly asistenciasClase: Repository<AsistenciaClase>,
    @InjectRepository(SolicitudJustificacion)
    private readonly solicitudes: Repository<SolicitudJustificacion>,
    @InjectRepository(Alumno) private readonly alumnos: Repository<Alumno>,
    private readonly config: ConfigService,
  ) {}

  async iniciarAcceso(dto: AccesoFamiliarDto) {
    const dni = dto.dni.trim();
    const dniHash = await this.registrarIntentoAcceso(dni);
    const alumno = await this.alumnos.createQueryBuilder('alumno')
      .addSelect('alumno.codigoAccesoFamiliaHash')
      .where('alumno.dni = :dni', { dni })
      .andWhere('alumno.activo = true')
      .getOne();
    if (
      !alumno?.codigoAccesoFamiliaHash
      || !this.compararCodigo(dto.codigoAcceso, alumno.codigoAccesoFamiliaHash)
    ) {
      throw new UnauthorizedException('DNI o código de acceso incorrectos');
    }
    await this.alumnos.manager.query(
      'DELETE FROM public.intentos_acceso_familiar WHERE dni_hash = $1',
      [dniHash],
    );

    const expiresAt = Date.now() + 4 * 60 * 60 * 1000;
    const fingerprint = createHash('sha256').update(alumno.codigoAccesoFamiliaHash).digest('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: alumno.id,
      exp: expiresAt,
      fingerprint,
    })).toString('base64url');
    const signature = createHmac('sha256', this.accessTokenSecret()).update(payload).digest('base64url');
    return {
      token: `fam.${payload}.${signature}`,
      expiresAt: new Date(expiresAt).toISOString(),
      alumno: {
        id: alumno.id,
        dni: alumno.dni,
        codigo: alumno.codigo,
        nombres: alumno.nombres,
        apellidos: alumno.apellidos,
      },
    };
  }

  async verificarTokenFamiliar(token: string) {
    const [prefix, payload, signature, extra] = token.split('.');
    if (prefix !== 'fam' || !payload || !signature || extra) {
      throw new UnauthorizedException('Sesión familiar inválida');
    }
    const expected = createHmac('sha256', this.accessTokenSecret()).update(payload).digest();
    const received = Buffer.from(signature, 'base64url');
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      throw new UnauthorizedException('Sesión familiar inválida');
    }

    let claims: { sub?: string; exp?: number; fingerprint?: string };
    try {
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Sesión familiar inválida');
    }
    if (!claims.sub || !claims.exp || claims.exp <= Date.now() || !claims.fingerprint) {
      throw new UnauthorizedException('La sesión familiar expiró. Ingresa nuevamente.');
    }
    const alumno = await this.alumnos.createQueryBuilder('alumno')
      .addSelect('alumno.codigoAccesoFamiliaHash')
      .where('alumno.id = :id', { id: claims.sub })
      .andWhere('alumno.activo = true')
      .getOne();
    if (!alumno?.codigoAccesoFamiliaHash) {
      throw new UnauthorizedException('La sesión familiar ya no es válida');
    }
    const fingerprint = createHash('sha256').update(alumno.codigoAccesoFamiliaHash).digest('base64url');
    if (fingerprint !== claims.fingerprint) {
      throw new UnauthorizedException('El código de acceso fue renovado. Ingresa nuevamente.');
    }
    return {
      id: alumno.id,
      alumnoId: alumno.id,
      nombres: alumno.nombres,
      apellidos: alumno.apellidos,
      rol: 'apoderado',
    };
  }

  private compararCodigo(code: string, storedHash: string) {
    const [saltValue, hashValue] = storedHash.split(':');
    if (!saltValue || !hashValue) return false;
    const salt = Buffer.from(saltValue, 'base64url');
    const expected = Buffer.from(hashValue, 'base64url');
    const received = scryptSync(code.trim().toUpperCase(), salt, expected.length);
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  private accessTokenSecret() {
    return this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
  }

  private async registrarIntentoAcceso(dni: string) {
    const dniHash = createHmac('sha256', this.accessTokenSecret()).update(dni).digest('hex');
    const [intento] = await this.alumnos.manager.query(
      `INSERT INTO public.intentos_acceso_familiar (dni_hash, intentos, inicio_ventana)
       VALUES ($1, 1, now())
       ON CONFLICT (dni_hash) DO UPDATE SET
         intentos = CASE
           WHEN intentos_acceso_familiar.inicio_ventana <= now() - interval '15 minutes' THEN 1
           ELSE intentos_acceso_familiar.intentos + 1
         END,
         inicio_ventana = CASE
           WHEN intentos_acceso_familiar.inicio_ventana <= now() - interval '15 minutes' THEN now()
           ELSE intentos_acceso_familiar.inicio_ventana
         END
       RETURNING intentos`,
      [dniHash],
    ) as { intentos: number }[];
    if (Number(intento.intentos) > 5) {
      throw new HttpException(
        'Demasiados intentos. Espera 15 minutos antes de volver a probar.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return dniHash;
  }

  private validarFecha(fecha: string) {
    const parsedDate = new Date(`${fecha}T12:00:00Z`);
    if (Number.isNaN(parsedDate.getTime()) || enLima(parsedDate).fecha !== fecha) {
      throw new BadRequestException('La fecha indicada no es válida');
    }
    if (fecha > enLima().fecha) {
      throw new BadRequestException('No se puede consultar ni justificar una fecha futura');
    }
  }

  async listarAlumnos(alumnoId: string) {
    const alumno = await this.alumnos.findOne({ where: { id: alumnoId, activo: true } });
    if (!alumno) throw new ForbiddenException('El acceso de este alumno está inactivo');
    const matriculas = await this.matriculas.find({
      where: { alumnoId },
      relations: { seccion: { grado: true } },
      order: { anioAcademicoId: 'DESC' },
    });
    return [{
      id: alumno.id,
      codigo: alumno.codigo,
      dni: alumno.dni,
      nombres: alumno.nombres,
      apellidos: alumno.apellidos,
      matriculas: matriculas.map((matricula) => ({
        id: matricula.id,
        anioAcademicoId: matricula.anioAcademicoId,
        estado: matricula.estado,
        seccion: `${matricula.seccion.grado.nivel} ${matricula.seccion.grado.nombre} "${matricula.seccion.nombre}"`,
      })),
    }];
  }

  async listarAsistencias(alumnoAutorizadoId: string, alumnoId: string, desde: string, hasta: string) {
    if (alumnoAutorizadoId !== alumnoId) {
      throw new ForbiddenException('No tienes acceso a las asistencias de otro alumno');
    }
    return (await this.obtenerAsistencias(alumnoId, desde, hasta, 300)).data;
  }

  async exportarAsistencias(alumnoAutorizadoId: string, alumnoId: string, desde: string, hasta: string) {
    if (alumnoAutorizadoId !== alumnoId) {
      throw new ForbiddenException('No tienes acceso a las asistencias de otro alumno');
    }
    const inicio = new Date(`${desde}T12:00:00Z`);
    const fin = new Date(`${hasta}T12:00:00Z`);
    if (fin.getTime() - inicio.getTime() > 30 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException('El reporte admite un máximo de 31 días');
    }
    return this.obtenerAsistencias(alumnoId, desde, hasta, 10_000);
  }

  private async obtenerAsistencias(alumnoId: string, desde: string, hasta: string, limite: number) {
    this.validarFecha(desde);
    this.validarFecha(hasta);
    if (desde > hasta) throw new BadRequestException('El rango de fechas no es válido');

    const autorizadas = await this.matriculas.find({
      where: { alumnoId },
      select: { id: true },
    });
    if (!autorizadas.length) throw new NotFoundException('No se encontraron matrículas del alumno');

    const registros = await this.asistencias.find({
      where: { matriculaId: In(autorizadas.map(({ id }) => id)), fecha: Between(desde, hasta) },
      relations: { matricula: { seccion: { grado: true } } },
      order: { fecha: 'DESC' },
      take: limite + 1,
    });
    const clases = await this.asistenciasClase.find({
      where: { matriculaId: In(autorizadas.map(({ id }) => id)), fecha: Between(desde, hasta) },
      relations: {
        matricula: { seccion: { grado: true } },
        horario: { curso: true },
      },
      order: { fecha: 'DESC' },
      take: limite + 1,
    });
    const ingresosFormateados = registros.map((registro) => ({
      id: registro.id,
      fecha: registro.fecha,
      estado: registro.estado,
      hora: registro.horaRegistro ? enLima(registro.horaRegistro).hora.slice(0, 5) : null,
      observacion: registro.observacion,
      seccion: `${registro.matricula.seccion.grado.nivel} ${registro.matricula.seccion.grado.nombre} "${registro.matricula.seccion.nombre}"`,
      tipo: 'ingreso' as const,
      curso: null,
    }));
    const clasesFormateadas = clases.map((registro) => ({
      id: `clase-${registro.id}`,
      fecha: registro.fecha,
      estado: registro.estado === EstadoAsistencia.FALTA
        ? EstadoAsistencia.EVASION
        : registro.estado,
      hora: registro.horario.horaInicio.slice(0, 5),
      observacion: null,
      seccion: `${registro.matricula.seccion.grado.nivel} ${registro.matricula.seccion.grado.nombre} "${registro.matricula.seccion.nombre}"`,
      tipo: 'clase' as const,
      curso: registro.horario.curso.nombre,
    }));
    const data = [...ingresosFormateados, ...clasesFormateadas]
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.hora ?? '').localeCompare(a.hora ?? ''))
    return {
      data: data.slice(0, limite),
      total: data.length,
      truncado: data.length > limite,
    };
  }

  async listarSolicitudesFamilia(alumnoId: string) {
    const matriculas = await this.matriculas.find({
      where: { alumnoId },
      select: { id: true },
    });
    if (!matriculas.length) return [];
    const solicitudes = await this.solicitudes.find({
      where: { matriculaId: In(matriculas.map(({ id }) => id)) },
      relations: { matricula: { alumno: true, seccion: { grado: true } } },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return solicitudes.map((solicitud) => this.formatoSolicitud(solicitud));
  }

  async crearSolicitud(alumnoId: string, dto: CrearSolicitudJustificacionDto) {
    this.validarFecha(dto.fecha);
    const motivo = dto.motivo.trim();
    if (motivo.length < 3) {
      throw new BadRequestException('El motivo debe tener al menos 3 caracteres');
    }
    const matricula = await this.matriculas.findOne({
      where: { id: dto.matriculaId, alumnoId },
      relations: { alumno: true },
    });
    if (!matricula || matricula.estado !== EstadoMatricula.ACTIVA || !matricula.alumno.activo) {
      throw new ForbiddenException('No tienes permiso para solicitar una justificación para esa matrícula');
    }

    const existePendiente = await this.solicitudes.exists({
      where: {
        matriculaId: matricula.id,
        fecha: dto.fecha,
        estado: EstadoSolicitudJustificacion.PENDIENTE,
      },
    });
    if (existePendiente) {
      throw new BadRequestException('Ya existe una solicitud pendiente para este alumno y fecha');
    }
    const asistencia = await this.asistencias.findOne({
      where: { matriculaId: matricula.id, fecha: dto.fecha },
    });
    if (
      asistencia?.estado === EstadoAsistencia.PRESENTE
      || asistencia?.estado === EstadoAsistencia.FALTA_JUSTIFICADA
      || asistencia?.estado === EstadoAsistencia.TARDANZA_JUSTIFICADA
    ) {
      throw new BadRequestException('El registro de asistencia de esa fecha ya fue confirmado');
    }
    if (asistencia?.estado === EstadoAsistencia.TARDANZA && dto.tipo !== 'tardanza_justificada') {
      throw new BadRequestException('Para esta asistencia solo se puede solicitar justificar la tardanza');
    }

    return this.solicitudes.save(this.solicitudes.create({
      matriculaId: matricula.id,
      fecha: dto.fecha,
      tipo: dto.tipo,
      motivo,
    }));
  }

  async listarPendientes() {
    const solicitudes = await this.solicitudes.find({
      where: { estado: EstadoSolicitudJustificacion.PENDIENTE },
      relations: { matricula: { alumno: true, seccion: { grado: true } } },
      order: { createdAt: 'ASC' },
      take: 200,
    });
    return solicitudes.map((solicitud) => this.formatoSolicitud(solicitud));
  }

  contarPendientes() {
    return this.solicitudes.count({ where: { estado: EstadoSolicitudJustificacion.PENDIENTE } });
  }

  async revisarSolicitud(
    id: string,
    dto: RevisarSolicitudJustificacionDto,
    revisorId: string,
  ) {
    await this.solicitudes.manager.transaction(async (manager) => {
      const solicitud = await manager.findOne(SolicitudJustificacion, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!solicitud) throw new NotFoundException('La solicitud no existe');
      if (solicitud.estado !== EstadoSolicitudJustificacion.PENDIENTE) {
        throw new BadRequestException('Esta solicitud ya fue revisada');
      }

      if (dto.estado === EstadoSolicitudJustificacion.APROBADA) {
        const asistenciaRepo = manager.getRepository(AsistenciaIngreso);
        const asistencia = await asistenciaRepo.findOne({
          where: { matriculaId: solicitud.matriculaId, fecha: solicitud.fecha },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          asistencia?.estado === EstadoAsistencia.PRESENTE
          || asistencia?.estado === EstadoAsistencia.FALTA_JUSTIFICADA
          || asistencia?.estado === EstadoAsistencia.TARDANZA_JUSTIFICADA
        ) {
          throw new BadRequestException('La asistencia cambió y ya no se puede aprobar esta solicitud');
        }
        if (asistencia?.estado === EstadoAsistencia.TARDANZA && solicitud.tipo !== 'tardanza_justificada') {
          throw new BadRequestException('La solicitud no coincide con la tardanza registrada');
        }
        const registro = asistencia ?? asistenciaRepo.create({
          matriculaId: solicitud.matriculaId,
          fecha: solicitud.fecha,
        });
        registro.estado = solicitud.tipo === 'falta_justificada'
          ? EstadoAsistencia.FALTA_JUSTIFICADA
          : EstadoAsistencia.TARDANZA_JUSTIFICADA;
        registro.metodo = MetodoRegistro.MANUAL;
        registro.registradoPor = revisorId;
        registro.horaRegistro = asistencia?.horaRegistro ?? null;
        registro.observacion = solicitud.motivo;
        await asistenciaRepo.save(registro);
      }

      solicitud.estado = dto.estado === 'aprobada'
        ? EstadoSolicitudJustificacion.APROBADA
        : EstadoSolicitudJustificacion.RECHAZADA;
      solicitud.revisadoPor = revisorId;
      solicitud.observacionRevision = dto.observacionRevision?.trim() || null;
      await manager.save(solicitud);
    });
    const saved = await this.solicitudes.findOne({
      where: { id },
      relations: { matricula: { alumno: true, seccion: { grado: true } } },
    });
    if (!saved) throw new NotFoundException('La solicitud ya no existe');
    return this.formatoSolicitud(saved);
  }

  private formatoSolicitud(solicitud: SolicitudJustificacion) {
    return {
      id: solicitud.id,
      fecha: solicitud.fecha,
      tipo: solicitud.tipo,
      motivo: solicitud.motivo,
      estado: solicitud.estado,
      observacionRevision: solicitud.observacionRevision,
      createdAt: solicitud.createdAt,
      alumno: {
        id: solicitud.matricula.alumno.id,
        nombres: solicitud.matricula.alumno.nombres,
        apellidos: solicitud.matricula.alumno.apellidos,
        codigo: solicitud.matricula.alumno.codigo,
      },
      seccion: `${solicitud.matricula.seccion.grado.nivel} ${solicitud.matricula.seccion.grado.nombre} "${solicitud.matricula.seccion.nombre}"`,
    };
  }
}

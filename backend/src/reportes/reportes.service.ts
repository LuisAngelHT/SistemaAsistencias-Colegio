import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { enLima } from '../common/fecha-lima';
import { AsistenciaClase } from '../asistencia/clase/asistencia-clase.entity';
import { AsistenciaIngreso } from '../asistencia/ingreso/asistencia-ingreso.entity';
import { EstadoAsistencia } from '../asistencia/asistencia.enums';

const MAX_FILAS_REPORTE = 10_000;

type ConteoDiario = {
  fecha: string;
  estado: string;
  cantidad: number;
};

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(AsistenciaIngreso)
    private readonly ingresos: Repository<AsistenciaIngreso>,
    @InjectRepository(AsistenciaClase)
    private readonly clases: Repository<AsistenciaClase>,
  ) {}

  private rangoUltimosSieteDias() {
    const hasta = enLima().fecha;
    const inicio = new Date(`${hasta}T12:00:00Z`);
    inicio.setUTCDate(inicio.getUTCDate() - 6);
    return { desde: inicio.toISOString().slice(0, 10), hasta };
  }

  async resumenIngreso() {
    const { desde, hasta } = this.rangoUltimosSieteDias();
    const rows = await this.ingresos.manager.query(`
      SELECT fecha::text AS fecha, estado::text AS estado, COUNT(*)::int AS cantidad
      FROM public.asistencia_ingreso
      WHERE fecha BETWEEN $1::date AND $2::date
      GROUP BY fecha, estado
    `, [desde, hasta]) as ConteoDiario[];
    const porFecha = new Map<string, {
      fecha: string;
      presentes: number;
      tardanzas: number;
      faltas: number;
    }>();
    for (let offset = 0; offset < 7; offset += 1) {
      const fecha = new Date(`${desde}T12:00:00Z`);
      fecha.setUTCDate(fecha.getUTCDate() + offset);
      const key = fecha.toISOString().slice(0, 10);
      porFecha.set(key, { fecha: key, presentes: 0, tardanzas: 0, faltas: 0 });
    }
    for (const row of rows) {
      const item = porFecha.get(row.fecha);
      if (!item) continue;
      const cantidad = Number(row.cantidad);
      if (
        row.estado === EstadoAsistencia.PRESENTE
        || row.estado === EstadoAsistencia.RETIRO_TEMPRANO
      ) item.presentes += cantidad;
      else if (
        row.estado === EstadoAsistencia.TARDANZA
        || row.estado === EstadoAsistencia.TARDANZA_JUSTIFICADA
      ) item.tardanzas += cantidad;
      else if (
        row.estado === EstadoAsistencia.FALTA
        || row.estado === EstadoAsistencia.FALTA_JUSTIFICADA
      ) item.faltas += cantidad;
    }
    return [...porFecha.values()];
  }

  async asistenciaUltimosSieteDias() {
    const { desde, hasta } = this.rangoUltimosSieteDias();
    const ingresos = await this.ingresos.find({
      where: { fecha: Between(desde, hasta) },
      relations: { matricula: { alumno: true, seccion: { grado: true } } },
      order: { fecha: 'DESC', horaRegistro: 'DESC' },
      take: MAX_FILAS_REPORTE + 1,
    });
    const data = ingresos.map((registro) => ({
      id: registro.id,
      fecha: registro.fecha,
      alumno: `${registro.matricula.alumno.nombres} ${registro.matricula.alumno.apellidos}`.trim(),
      dni: registro.matricula.alumno.dni,
      codigo: registro.matricula.alumno.codigo,
      seccion: `${registro.matricula.seccion.grado.nombre} "${registro.matricula.seccion.nombre}"`,
      estado: registro.estado,
      hora: registro.horaRegistro ? enLima(registro.horaRegistro).hora.slice(0, 5) : '',
    }));

    return {
      data: data.slice(0, MAX_FILAS_REPORTE),
      total: data.length,
      truncado: data.length > MAX_FILAS_REPORTE,
      desde,
      hasta,
    };
  }

  async evasionesRecientes() {
    const { desde, hasta } = this.rangoUltimosSieteDias();
    const registros = await this.clases.find({
      where: {
        fecha: Between(desde, hasta),
        estado: In([EstadoAsistencia.EVASION, EstadoAsistencia.FALTA]),
      },
      relations: {
        matricula: { alumno: true, seccion: { grado: true } },
        horario: { curso: true },
      },
      order: { fecha: 'DESC', horario: { horaInicio: 'DESC' } },
      take: 100,
    });
    return registros.map((registro) => ({
      id: registro.id,
      fecha: registro.fecha,
      hora: registro.horario.horaInicio.slice(0, 5),
      alumno: `${registro.matricula.alumno.nombres} ${registro.matricula.alumno.apellidos}`.trim(),
      curso: registro.horario.curso.nombre,
      seccion: `${registro.matricula.seccion.grado.nombre} "${registro.matricula.seccion.nombre}"`,
    }));
  }
}

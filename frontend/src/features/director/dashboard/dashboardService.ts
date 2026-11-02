import { apiUrl, supabase } from '../../../lib/supabase'
import type { DashboardSummary } from './types'

type UsuarioRecord = {
  activo: boolean
}

type AlumnoPage = {
  total: number
}

type HorarioRecord = {
  activo: boolean
}

export type AttendanceTrendPoint = {
  fecha: string
  presentes: number
  tardanzas: number
  faltas: number
}

export type AttendanceReportRow = {
  id: string
  fecha: string
  alumno: string
  dni: string
  codigo: string
  seccion: string
  estado: string
  hora: string
}

export type EvasionAlert = {
  id: string
  fecha: string
  hora: string
  alumno: string
  curso: string
  seccion: string
}

async function apiGet<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string | string[] }
      | null
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message
    throw new Error(message || `No se pudo cargar ${path}.`)
  }

  return (await response.json()) as T
}

async function getAccessToken(): Promise<string> {
  if (!supabase) throw new Error('Falta configurar Supabase. Revisa las variables de entorno del frontend.')
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error('No se pudo validar la sesión para cargar los reportes.')
  if (!data.session) throw new Error('La sesión expiró. Inicia sesión nuevamente.')
  return data.session.access_token
}

export async function getAttendanceTrend(): Promise<AttendanceTrendPoint[]> {
  const token = await getAccessToken()
  return apiGet<AttendanceTrendPoint[]>('/reportes/resumen-asistencia', token)
}

export async function getAttendanceReport(): Promise<{
  data: AttendanceReportRow[]
  total: number
  truncado: boolean
  desde: string
  hasta: string
}> {
  const token = await getAccessToken()
  return apiGet('/reportes/asistencia', token)
}

export async function getEvasionAlerts(): Promise<EvasionAlert[]> {
  const token = await getAccessToken()
  return apiGet<EvasionAlert[]>('/reportes/evasiones-recientes', token)
}

function activeCount(records: UsuarioRecord[] | HorarioRecord[]): number {
  return records.filter((record) => record.activo).length
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  if (!supabase) {
    throw new Error(
      'Falta configurar Supabase. Revisa las variables de entorno del frontend.',
    )
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) {
    throw new Error('No se pudo validar la sesión para cargar el dashboard.')
  }
  if (!data.session) {
    throw new Error('La sesión expiró. Inicia sesión nuevamente.')
  }

  const token = data.session.access_token
  const [profesores, auxiliares, alumnos, secciones, grados, horarios] =
    await Promise.all([
      apiGet<UsuarioRecord[]>('/usuarios?rol=profesor', token),
      apiGet<UsuarioRecord[]>('/usuarios?rol=auxiliar', token),
      apiGet<AlumnoPage>('/alumnos?limit=1', token),
      apiGet<unknown[]>('/secciones', token),
      apiGet<unknown[]>('/grados', token),
      apiGet<HorarioRecord[]>('/horarios', token),
    ])

  return {
    profesores: activeCount(profesores),
    auxiliares: activeCount(auxiliares),
    alumnos: alumnos.total,
    secciones: secciones.length,
    grados: grados.length,
    horarios: activeCount(horarios),
  }
}

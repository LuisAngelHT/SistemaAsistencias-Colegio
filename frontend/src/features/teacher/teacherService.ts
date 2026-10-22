import { apiUrl, supabase } from '../../lib/supabase'

export type TeacherSchedule = {
  id: number
  diaSemana: number
  horaInicio: string
  horaFin: string
  curso: { id: number; nombre: string }
  seccion: {
    id: number
    nombre: string
    grado: { id: number; nombre: string; nivel: string }
  }
}

export type AttendanceState = 'presente' | 'falta'

export type ClassAttendance = {
  horarioId: number
  fecha: string
  curso: string
  seccion: { id: number; nombre: string; grado: string; nivel: string }
  alumnos: {
    matriculaId: string
    alumno: {
      id: string
      codigo: string
      nombres: string
      apellidos: string
      fotoUrl: string | null
    }
    estado: AttendanceState | null
  }[]
}

async function accessToken(): Promise<string> {
  if (!supabase) {
    throw new Error('Falta configurar Supabase. Revisa las variables del frontend.')
  }
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error('No se pudo validar la sesión actual.')
  if (!data.session) throw new Error('La sesión expiró. Inicia sesión nuevamente.')
  return data.session.access_token
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await accessToken()
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string | string[] }
      | null
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message
    throw new Error(message || `La solicitud falló (${response.status}).`)
  }

  return response.status === 204 ? (undefined as T) : (await response.json() as T)
}

export function getTeacherSchedules(): Promise<TeacherSchedule[]> {
  return request<TeacherSchedule[]>('/horarios/mis-horarios')
}

export function getClassAttendance(
  horarioId: number,
  fecha: string,
): Promise<ClassAttendance> {
  const search = new URLSearchParams({ horarioId: String(horarioId), fecha })
  return request<ClassAttendance>(`/asistencia/clase?${search}`)
}

export function saveClassAttendance(
  horarioId: number,
  fecha: string,
  alumnos: { matriculaId: string; estado: AttendanceState }[],
): Promise<ClassAttendance> {
  return request<ClassAttendance>(`/asistencia/clase?horarioId=${horarioId}`, {
    method: 'POST',
    body: JSON.stringify({ fecha, alumnos }),
  })
}

export function limaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())
}

export function limaWeekday(): number {
  const day = new Date(`${limaToday()}T12:00:00Z`).getUTCDay()
  return day === 0 ? 7 : day
}

export function weekdayLabel(day: number): string {
  return ({
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes',
    6: 'Sábado',
    7: 'Domingo',
  } as Record<number, string>)[day] ?? 'Horario'
}

export function timeLabel(time: string): string {
  return time.slice(0, 5)
}

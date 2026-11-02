import { apiUrl, supabase } from '../../lib/supabase'

export type AuxiliarySection = {
  id: number
  nombre: string
  grado: { nombre: string; nivel: string }
}

export type SectionAttendance = {
  fecha: string
  seccionId: number
  total: number
  presentes: number
  tardanzas: number
  faltas: number
  justificadas: number
  sinRegistrar: number
  alumnos: {
    matriculaId: string
    alumno: {
      id: string
      codigo: string
      nombres: string
      apellidos: string
      fotoUrl: string | null
    }
    estado: string | null
    hora: string | null
    metodo: string | null
    observacion: string | null
  }[]
}

export type ScanResult = {
  resultado: 'registrado' | 'ya_registrado'
  mensaje: string
  estado: string
  fecha: string
  hora: string | null
  alumno: {
    id: string
    codigo: string
    nombres: string
    apellidos: string
    fotoUrl: string | null
  }
  seccion: string
}

export type EntryConfiguration = {
  horaIngreso: string
  toleranciaMin: number
  horaLimite: string
  updatedAt: string
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!supabase) {
    throw new Error('Falta configurar Supabase. Revisa las variables del frontend.')
  }
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error('No se pudo validar la sesión actual.')
  if (!data.session) throw new Error('La sesión expiró. Inicia sesión nuevamente.')

  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
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

export function getSections(): Promise<AuxiliarySection[]> {
  return request<AuxiliarySection[]>('/secciones')
}

export function getSectionAttendance(
  sectionId: number,
  fecha = limaToday(),
): Promise<SectionAttendance> {
  const search = new URLSearchParams({ seccionId: String(sectionId), fecha })
  return request<SectionAttendance>(`/asistencia/ingreso?${search}`)
}

export function getSectionEnrollments(sectionId: number) {
  return request<{
    id: string
    estado: string
    alumno: SectionAttendance['alumnos'][number]['alumno']
  }[]>(`/matriculas?seccionId=${sectionId}`)
}

export function scanStudentCode(codigo: string): Promise<ScanResult> {
  return request<ScanResult>('/asistencia/ingreso/scan', {
    method: 'POST',
    body: JSON.stringify({ codigo, metodo: 'qr_camara' }),
  })
}

export function markStudentAttendance(
  matriculaId: string,
  estado: 'presente' | 'tardanza' | 'falta',
): Promise<unknown> {
  return request('/asistencia/ingreso/manual', {
    method: 'POST',
    body: JSON.stringify({ matriculaId, estado }),
  })
}

export function getEntryConfiguration(): Promise<EntryConfiguration> {
  return request<EntryConfiguration>('/asistencia/ingreso/configuracion')
}

export function updateEntryConfiguration(data: Pick<EntryConfiguration, 'horaIngreso' | 'toleranciaMin' | 'horaLimite'>) {
  return request<EntryConfiguration>('/asistencia/ingreso/configuracion', {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function limaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())
}

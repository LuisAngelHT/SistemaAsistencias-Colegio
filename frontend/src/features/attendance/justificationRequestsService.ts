import { apiUrl, supabase } from '../../lib/supabase'

const familyTokenKey = 'asiste-family-access-token'

export type RequestState = 'pendiente' | 'aprobada' | 'rechazada'
export type RequestType = 'falta_justificada' | 'tardanza_justificada'

export type FamilyStudent = {
  id: string
  codigo: string
  nombres: string
  apellidos: string
  matriculas: {
    id: string
    anioAcademicoId: number
    estado: string
    seccion: string
  }[]
}

export type FamilyAttendance = {
  id: string
  fecha: string
  estado: string
  hora: string | null
  observacion: string | null
  seccion: string
  tipo: 'ingreso' | 'clase'
  curso: string | null
}

export type JustificationRequest = {
  id: string
  fecha: string
  tipo: RequestType
  motivo: string
  estado: RequestState
  observacionRevision: string | null
  createdAt: string
  alumno: { id: string; nombres: string; apellidos: string; codigo: string }
  seccion: string
}

async function staffRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!supabase) throw new Error('Falta configurar Supabase. Revisa las variables del frontend.')
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
    const body = await response.json().catch(() => null) as { message?: string | string[] } | null
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message
    throw new Error(message || `La solicitud falló (${response.status}).`)
  }
  return response.status === 204 ? undefined as T : await response.json() as T
}

async function familyRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem(familyTokenKey)
  if (!token) throw new Error('La sesión familiar expiró. Ingresa nuevamente.')
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string | string[] } | null
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message
    if (response.status === 401) clearFamilyAccess()
    throw new Error(message || `La solicitud falló (${response.status}).`)
  }
  return response.status === 204 ? undefined as T : await response.json() as T
}

export async function accessFamily(dni: string, codigoAcceso: string) {
  const response = await fetch(`${apiUrl}/portal-familiar/acceso`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dni: dni.trim(), codigoAcceso: codigoAcceso.trim().toUpperCase() }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string | string[] } | null
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message
    throw new Error(message || 'DNI o código de acceso incorrectos.')
  }
  const result = await response.json() as {
    token: string
    alumno: { id: string; nombres: string; apellidos: string }
  }
  sessionStorage.setItem(familyTokenKey, result.token)
  return {
    nombres: result.alumno.nombres,
    apellidos: result.alumno.apellidos,
    email: '',
    rol: 'apoderado' as const,
  }
}

export async function restoreFamilyAccess() {
  const token = sessionStorage.getItem(familyTokenKey)
  if (!token) return null
  try {
    const students = await familyRequest<FamilyStudent[]>('/portal-familiar/alumnos')
    const student = students[0]
    if (!student) {
      clearFamilyAccess()
      return null
    }
    return {
      nombres: student.nombres,
      apellidos: student.apellidos,
      email: '',
      rol: 'apoderado' as const,
    }
  } catch {
    clearFamilyAccess()
    return null
  }
}

export function clearFamilyAccess() {
  sessionStorage.removeItem(familyTokenKey)
}

export function getFamilyStudents() {
  return familyRequest<FamilyStudent[]>('/portal-familiar/alumnos')
}

export function getFamilyAttendance(alumnoId: string, desde: string, hasta: string) {
  const query = new URLSearchParams({ desde, hasta })
  return familyRequest<FamilyAttendance[]>(`/portal-familiar/alumnos/${alumnoId}/asistencias?${query}`)
}

export function exportFamilyAttendance(alumnoId: string, desde: string, hasta: string) {
  const query = new URLSearchParams({ desde, hasta })
  return familyRequest<{
    data: FamilyAttendance[]
    total: number
    truncado: boolean
  }>(`/portal-familiar/alumnos/${alumnoId}/reporte-asistencias?${query}`)
}

export function getFamilyRequests() {
  return familyRequest<JustificationRequest[]>('/portal-familiar/solicitudes')
}

export function createFamilyRequest(data: {
  matriculaId: string
  fecha: string
  tipo: RequestType
  motivo: string
}) {
  return familyRequest<JustificationRequest>('/portal-familiar/solicitudes', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export const pendingRequestsKey = ['staff-justification-requests'] as const
export const pendingRequestCountKey = ['staff-justification-request-count'] as const

export function getPendingRequests() {
  return staffRequest<JustificationRequest[]>('/solicitudes-justificacion')
}

export function getPendingRequestCount() {
  return staffRequest<number>('/solicitudes-justificacion/count')
}

export function reviewRequest(
  id: string,
  data: { estado: 'aprobada' | 'rechazada'; observacionRevision?: string },
) {
  return staffRequest<JustificationRequest>(`/solicitudes-justificacion/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function limaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())
}

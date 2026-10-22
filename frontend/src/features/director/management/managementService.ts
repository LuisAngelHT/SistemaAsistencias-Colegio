import { apiUrl, supabase } from '../../../lib/supabase'
import type {
  ApiRecord,
  ListResult,
  ManagementModule,
  ManagementOptions,
} from './types'

const pageSize = 20

async function getAccessToken(): Promise<string> {
  if (!supabase) {
    throw new Error('Falta configurar Supabase. Revisa las variables del frontend.')
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error('No se pudo validar la sesión actual.')
  if (!data.session) throw new Error('La sesión expiró. Inicia sesión nuevamente.')
  return data.session.access_token
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken()

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

  const result = response.status === 204
    ? undefined
    : await response.json() as T
  return result as T
}

function resourcePath(module: ManagementModule): string {
  switch (module) {
    case 'profesores':
      return '/usuarios?rol=profesor'
    case 'auxiliares':
      return '/usuarios?rol=auxiliar'
    case 'alumnos':
      return '/alumnos'
    case 'secciones':
      return '/secciones'
    case 'grados':
      return '/grados'
    case 'horarios':
      return '/horarios'
    case 'cursos':
      return '/cursos'
    case 'anios-academicos':
      return '/anios-academicos'
    case 'matriculas':
      return '/matriculas'
  }
}

export async function listRecords(
  module: ManagementModule,
  page: number,
  query: string,
): Promise<ListResult> {
  if (module === 'matriculas') {
    throw new Error('Las matrículas deben consultarse por sección.')
  }

  if (module === 'alumnos') {
    const search = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    })
    if (query.trim()) search.set('q', query.trim())
    const result = await request<{
      data: ApiRecord[]
      total: number
      page: number
      limit: number
    }>(`/alumnos?${search}`)
    return result
  }

  const records = await request<ApiRecord[]>(resourcePath(module))
  const filtered = query.trim()
    ? records.filter((record) => {
        const haystack = [
          record.nombres,
          record.apellidos,
          record.email,
          record.dni,
          record.codigo,
          record.nombre,
        ]
          .filter((value): value is string => typeof value === 'string')
          .join(' ')
          .toLocaleLowerCase()
        return haystack.includes(query.trim().toLocaleLowerCase())
      })
    : records

  return {
    data: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    limit: pageSize,
  }
}

export async function loadManagementOptions(
  module: ManagementModule,
): Promise<ManagementOptions> {
  const empty: ManagementOptions = {
    years: [],
    grades: [],
    teachers: [],
    sections: [],
    courses: [],
  }
  const endpoints: Partial<Record<keyof ManagementOptions, string>> = {
    ...(module === 'secciones' && {
      years: '/anios-academicos',
      grades: '/grados',
      teachers: '/usuarios?rol=profesor',
    }),
    ...(module === 'horarios' && {
      sections: '/secciones',
      courses: '/cursos?activos=true',
      teachers: '/usuarios?rol=profesor',
    }),
    ...(module === 'matriculas' && {
      sections: '/secciones',
    }),
  }
  const entries = Object.entries(endpoints) as [keyof ManagementOptions, string][]
  const values = await Promise.all(
    entries.map(([, path]) => request<ApiRecord[]>(path)),
  )
  for (const [index, [key]] of entries.entries()) {
    empty[key] = values[index]
  }
  empty.teachers = empty.teachers.filter((teacher) => teacher.activo === true)
  return empty
}

export async function createRecord(
  module: ManagementModule,
  payload: ApiRecord,
): Promise<ApiRecord> {
  return request<ApiRecord>(resourcePath(module).split('?')[0], {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateRecord(
  module: ManagementModule,
  id: string | number,
  payload: ApiRecord,
): Promise<ApiRecord> {
  return request<ApiRecord>(`${resourcePath(module).split('?')[0]}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function setRecordActive(
  module: ManagementModule,
  id: string | number,
  active: boolean,
): Promise<void> {
  if (module === 'profesores' || module === 'auxiliares') {
    await request<ApiRecord>(
      active ? `/usuarios/${id}/activar` : `/usuarios/${id}`,
      { method: active ? 'PATCH' : 'DELETE' },
    )
    return
  }

  if (module === 'alumnos') {
    await updateRecord(module, id, { activo: active })
    return
  }

  throw new Error('El estado solo se puede cambiar para profesores, auxiliares y alumnos.')
}

export async function deleteRecord(
  module: ManagementModule,
  id: string | number,
): Promise<void> {
  if (module === 'matriculas') {
    throw new Error('Las matrículas deben actualizarse desde su sección.')
  }
  await request(`${resourcePath(module).split('?')[0]}/${id}`, {
    method: 'DELETE',
  })
}

export async function listEnrollments(sectionId: number): Promise<ApiRecord[]> {
  return request<ApiRecord[]>(`/matriculas?seccionId=${sectionId}`)
}

export async function searchStudents(
  query: string,
  page = 1,
): Promise<{ data: ApiRecord[]; total: number }> {
  const search = new URLSearchParams({
    q: query,
    page: String(page),
    limit: '10',
  })
  return request<{ data: ApiRecord[]; total: number }>(`/alumnos?${search}`)
}

export async function createEnrollment(
  studentId: string,
  sectionId: number,
): Promise<ApiRecord> {
  return request<ApiRecord>('/matriculas', {
    method: 'POST',
    body: JSON.stringify({ alumnoId: studentId, seccionId: sectionId }),
  })
}

export async function updateEnrollmentStatus(
  enrollmentId: string,
  status: string,
): Promise<ApiRecord> {
  return request<ApiRecord>(`/matriculas/${enrollmentId}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estado: status }),
  })
}

export async function moveEnrollment(
  enrollmentId: string,
  sectionId: number,
): Promise<ApiRecord> {
  return request<ApiRecord>(`/matriculas/${enrollmentId}/seccion`, {
    method: 'PATCH',
    body: JSON.stringify({ seccionId: sectionId }),
  })
}

export function buildPayload(
  module: ManagementModule,
  values: Record<string, string>,
  isEditing: boolean,
): ApiRecord {
  const optional = (name: string): string | undefined =>
    values[name]?.trim() || undefined

  switch (module) {
    case 'profesores':
    case 'auxiliares':
      if (isEditing) {
        return {
          nombres: values.nombres.trim(),
          apellidos: values.apellidos.trim(),
          dni: optional('dni'),
          telefono: optional('telefono'),
        }
      }
      return {
        nombres: values.nombres.trim(),
        apellidos: values.apellidos.trim(),
        email: values.email.trim(),
        password: values.password,
        rol: module === 'profesores' ? 'profesor' : 'auxiliar',
        dni: optional('dni'),
        telefono: optional('telefono'),
      }
    case 'alumnos':
      return {
        nombres: values.nombres.trim(),
        apellidos: values.apellidos.trim(),
        codigo: optional('codigo'),
        dni: optional('dni'),
        fechaNacimiento: optional('fechaNacimiento'),
        ...(isEditing ? { activo: values.activo === 'true' } : {}),
      }
    case 'secciones':
      return {
        ...(!isEditing && { anioAcademicoId: Number(values.anioAcademicoId) }),
        gradoId: Number(values.gradoId),
        nombre: values.nombre.trim(),
        tutorId: optional('tutorId'),
        horaIngreso: values.horaIngreso,
        toleranciaMin: Number(values.toleranciaMin),
      }
    case 'grados':
      return {
        nivel: values.nivel,
        nombre: values.nombre.trim(),
        orden: Number(values.orden),
      }
    case 'cursos':
      return {
        nombre: values.nombre.trim(),
        codigo: optional('codigo'),
      }
    case 'anios-academicos':
      return {
        nombre: values.nombre.trim(),
        fechaInicio: values.fechaInicio,
        fechaFin: values.fechaFin,
      }
    case 'matriculas':
      throw new Error('Las matrículas se crean seleccionando alumno y sección.')
    case 'horarios':
      return {
        ...(!isEditing && { seccionId: Number(values.seccionId) }),
        cursoId: Number(values.cursoId),
        profesorId: values.profesorId,
        diaSemana: Number(values.diaSemana),
        horaInicio: values.horaInicio,
        horaFin: values.horaFin,
      }
  }
}

export { pageSize }

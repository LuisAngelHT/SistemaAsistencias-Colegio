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

import type { Session } from '@supabase/supabase-js'
import { apiUrl, supabase } from '../../lib/supabase'
import type { Usuario } from './types'

async function getUsuario(session: Session): Promise<Usuario> {
  const response = await fetch(`${apiUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string | string[] }
      | null
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message
    throw new Error(message || 'No se pudo validar tu usuario en el sistema.')
  }

  return (await response.json()) as Usuario
}

export async function getCurrentUsuario(): Promise<Usuario | null> {
  if (!supabase) return null

  const { data, error } = await supabase.auth.getSession()
  if (error) {
    throw new Error('No se pudo recuperar la sesión. Intenta iniciar sesión nuevamente.')
  }
  if (!data.session) return null

  try {
    return await getUsuario(data.session)
  } catch {
    await supabase.auth.signOut()
    throw new Error('Tu sesión ya no es válida. Inicia sesión para continuar.')
  }
}

export async function signIn(email: string, password: string): Promise<Usuario> {
  if (!supabase) {
    throw new Error(
      'Falta configurar Supabase. Añade VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY al archivo .env.local.',
    )
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (error) {
    throw new Error(
      error.message === 'Invalid login credentials'
        ? 'Correo o contraseña incorrectos.'
        : error.message,
    )
  }
  if (!data.session) {
    throw new Error('No se recibió una sesión válida. Inténtalo nuevamente.')
  }

  try {
    return await getUsuario(data.session)
  } catch (profileError) {
    await supabase.auth.signOut()
    throw profileError
  }
}

export async function signOut(): Promise<void> {
  if (!supabase) return

  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function subscribeToSignOut(onSignOut: () => void): () => void {
  if (!supabase) return () => {}

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') onSignOut()
  })

  return () => subscription.unsubscribe()
}

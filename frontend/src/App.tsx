import { lazy, Suspense, useEffect, useState } from 'react'
import { queryClient } from './lib/queryClient'
import { BrandMark } from './features/auth/BrandMark'
import { LoginPage } from './features/auth/LoginPage'
import { DirectorDashboard } from './features/director/dashboard/DirectorDashboard'
import {
  getCurrentUsuario,
  signIn,
  signOut,
  subscribeToSignOut,
} from './features/auth/authService'
import type { Usuario } from './features/auth/types'

const TeacherDashboard = lazy(() =>
  import('./features/teacher/TeacherDashboard').then((module) => ({
    default: module.TeacherDashboard,
  })),
)
const AuxiliaryDashboard = lazy(() =>
  import('./features/auxiliary/AuxiliaryDashboard').then((module) => ({
    default: module.AuxiliaryDashboard,
  })),
)

const roleLabels: Record<Usuario['rol'], string> = {
  director: 'Director',
  auxiliar: 'Auxiliar',
  profesor: 'Profesor',
}

function App() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRestoring, setIsRestoring] = useState(true)
  const [error, setError] = useState('')
  const [usuario, setUsuario] = useState<Usuario | null>(null)

  useEffect(() => {
    let isMounted = true

    const restoreSession = async () => {
      try {
        const profile = await getCurrentUsuario()
        if (isMounted) setUsuario(profile)
      } catch (restoreError) {
        if (isMounted) {
          setError(
            restoreError instanceof Error
              ? restoreError.message
              : 'No se pudo recuperar la sesión. Intenta iniciar sesión nuevamente.',
          )
        }
      } finally {
        if (isMounted) setIsRestoring(false)
      }
    }

    void restoreSession()
    const unsubscribe = subscribeToSignOut(() => {
      if (isMounted) {
        queryClient.clear()
        setUsuario(null)
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  const handleLogin = async (email: string, password: string) => {
    setError('')
    setIsSubmitting(true)
    try {
      setUsuario(await signIn(email, password))
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'No se pudo iniciar sesión. Inténtalo nuevamente.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      queryClient.clear()
      setUsuario(null)
      setError('')
    } catch {
      setError('No se pudo cerrar la sesión. Inténtalo nuevamente.')
    }
  }

  if (isRestoring) {
    return (
      <main className="loading-screen" aria-label="Cargando sesión">
        <span className="loading-spinner" />
        <span>Preparando tu espacio...</span>
      </main>
    )
  }

  if (usuario) {
    if (usuario.rol === 'director') {
      return (
        <DirectorDashboard
          usuario={usuario}
          error={error}
          onSignOut={handleSignOut}
        />
      )
    }

    if (usuario.rol === 'profesor') {
      return (
        <Suspense
          fallback={
            <main className="loading-screen" aria-label="Cargando panel del profesor">
              <span className="loading-spinner" />
              <span>Preparando tu espacio...</span>
            </main>
          }
        >
          <TeacherDashboard usuario={usuario} onSignOut={handleSignOut} />
        </Suspense>
      )
    }

    if (usuario.rol === 'auxiliar') {
      return (
        <Suspense
          fallback={
            <main className="loading-screen" aria-label="Cargando panel del auxiliar">
              <span className="loading-spinner" />
              <span>Preparando tu espacio...</span>
            </main>
          }
        >
          <AuxiliaryDashboard usuario={usuario} onSignOut={handleSignOut} />
        </Suspense>
      )
    }

    return (
      <main className="welcome-screen">
        <section className="welcome-card">
          <BrandMark />
          <span className="eyebrow">ASISTENCIA ESCOLAR</span>
          <h1>¡Qué bueno verte, {usuario.nombres}!</h1>
          <p>
            Has iniciado sesión como <strong>{roleLabels[usuario.rol]}</strong>.
            Tu espacio de trabajo estará disponible aquí.
          </p>
          <div className="account-summary">
            <span className="account-avatar">
              {usuario.nombres.charAt(0)}
              {usuario.apellidos.charAt(0)}
            </span>
            <span>
              <strong>{usuario.nombres} {usuario.apellidos}</strong>
              <small>{usuario.email}</small>
            </span>
            <span className="role-chip">{roleLabels[usuario.rol]}</span>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="text-button signout-button" onClick={handleSignOut}>
            Cerrar sesión
          </button>
        </section>
      </main>
    )
  }

  return (
    <LoginPage
      error={error}
      isSubmitting={isSubmitting}
      onSubmit={handleLogin}
    />
  )
}

export default App

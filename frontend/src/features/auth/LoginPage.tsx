import { useState, type FormEvent } from 'react'
import { BrandMark } from './BrandMark'
import './LoginPage.css'

type LoginPageProps = {
  error: string
  isSubmitting: boolean
  onSubmit: (email: string, password: string) => Promise<void>
}

const currentYear = new Date().getFullYear()

export function LoginPage({ error, isSubmitting, onSubmit }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onSubmit(email, password)
  }

  return (
    <main className="login-layout">
      <section className="welcome-panel" aria-label="Sistema de asistencia escolar">
        <div className="panel-top">
          <a className="brand" href="/" aria-label="Asiste, inicio">
            <BrandMark />
            <span>asiste<span className="brand-period">.</span></span>
          </a>
          <span className="school-tag">PLATAFORMA ESCOLAR</span>
        </div>

        <div className="panel-copy">
          <span className="eyebrow">PRESENTES EN CADA MOMENTO</span>
          <h1>Una comunidad<br />que siempre<br /><em>está presente.</em></h1>
          <p>
            Gestiona la asistencia escolar de forma simple, segura y en tiempo
            real.
          </p>
        </div>

        <div className="attendance-illustration" aria-hidden="true">
          <div className="illustration-glow" />
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="attendance-card">
            <div className="card-topline">
              <span className="mini-mark"><BrandMark /></span>
              <span className="card-label">REGISTRO DE HOY</span>
              <span className="live-dot" />
            </div>
            <div className="attendance-number">248<span>/ 260</span></div>
            <div className="attendance-caption">alumnos presentes</div>
            <div className="attendance-progress"><span /></div>
            <div className="card-footer">
              <span><i className="legend-dot present" /> Presentes</span>
              <span><i className="legend-dot pending" /> Por llegar</span>
            </div>
          </div>
          <div className="floating-check" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none">
              <path d="m4.5 10.5 3.4 3.3 7.6-7.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="floating-star" aria-hidden="true">✳</div>
        </div>

        <div className="panel-footer">
          <span>ASISTENCIA, MÁS CERCA.</span>
          <span>© {currentYear} ASISTE</span>
        </div>
      </section>

      <section className="form-panel">
        <div className="mobile-brand">
          <BrandMark />
          <span>asiste<span className="brand-period">.</span></span>
        </div>
        <div className="login-form-wrap">
          <div className="form-heading">
            <span className="eyebrow">TU ESPACIO DE TRABAJO</span>
            <h2>Bienvenido de nuevo</h2>
            <p>Ingresa tus datos para acceder a tu cuenta.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="email">Correo electrónico</label>
            <div className="input-wrap">
              <svg className="input-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="2.5" y="4" width="15" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="m3.5 5 6.5 5 6.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="nombre@colegio.edu"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="password-label-row">
              <label className="field-label" htmlFor="password">Contraseña</label>
            </div>
            <div className="input-wrap">
              <svg className="input-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="3.5" y="8" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M6.5 8V5.75a3.5 3.5 0 0 1 7 0V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="10" cy="12.5" r="1" fill="currentColor" />
              </svg>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M3 3 17 17M8.6 8.7a2 2 0 0 0 2.7 2.7M6.2 6.3A9 9 0 0 1 10 5.5c4 0 6.8 3.2 7.5 4.5a8.8 8.8 0 0 1-2.1 2.6M4.2 7.8A10 10 0 0 0 2.5 10c.7 1.3 3.5 4.5 7.5 4.5a8.5 8.5 0 0 0 2.3-.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M2.5 10S5.2 5.5 10 5.5s7.5 4.5 7.5 4.5-2.7 4.5-7.5 4.5S2.5 10 2.5 10Z" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                )}
              </button>
            </div>

            {error && (
              <p className="form-error" role="alert">
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M10 6.5v4M10 13.5h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
                {error}
              </p>
            )}

            <button className="submit-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="button-spinner" />
                  Verificando acceso...
                </>
              ) : (
                <>
                  Iniciar sesión
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="secure-note">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Acceso seguro para el personal autorizado
          </div>
        </div>

        <footer className="form-footer">
          <span>¿Necesitas ayuda? Contacta al administrador de tu colegio.</span>
        </footer>
      </section>
    </main>
  )
}

import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { BrandMark } from '../../auth/BrandMark'
import type { Usuario } from '../../auth/types'
import type { ManagementModule } from '../management/types'
import { getDashboardSummary } from './dashboardService'
import type { DashboardSummary } from './types'
import { dashboardSummaryKey } from '../queryKeys'

const DirectorManagement = lazy(() =>
  import('../management/DirectorManagement').then((module) => ({
    default: module.DirectorManagement,
  })),
)
const EnrollmentsPanel = lazy(() =>
  import('../management/EnrollmentsPanel').then((module) => ({
    default: module.EnrollmentsPanel,
  })),
)

type DirectorDashboardProps = {
  usuario: Usuario
  error: string
  onSignOut: () => Promise<void>
}

const dateLabel = new Intl.DateTimeFormat('es-PE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date())

const managementItems = [
  { id: 'profesores', title: 'Profesores', detail: 'Cuentas y datos del personal docente', icon: 'teacher' },
  { id: 'auxiliares', title: 'Auxiliares', detail: 'Personal de apoyo y accesos', icon: 'support' },
  { id: 'alumnos', title: 'Alumnos', detail: 'Registro y datos de estudiantes', icon: 'students' },
  { id: 'matriculas', title: 'Matrículas', detail: 'Asignar alumnos a secciones', icon: 'students' },
  { id: 'secciones', title: 'Secciones', detail: 'Grupos y tutores por año', icon: 'sections' },
  { id: 'grados', title: 'Grados', detail: 'Niveles y estructura académica', icon: 'grades' },
  { id: 'horarios', title: 'Horarios', detail: 'Cursos, profesores y bloques', icon: 'schedule' },
  { id: 'cursos', title: 'Cursos', detail: 'Materias que se asignan a cada horario', icon: 'courses' },
  { id: 'anios-academicos', title: 'Años académicos', detail: 'Periodos escolares y año vigente', icon: 'calendar' },
] as const

const statCards: {
  key: keyof DashboardSummary
  label: string
  icon: string
  tone: string
}[] = [
  { key: 'alumnos', label: 'Alumnos registrados', icon: 'students', tone: 'mint' },
  { key: 'profesores', label: 'Profesores activos', icon: 'teacher', tone: 'blue' },
  { key: 'auxiliares', label: 'Auxiliares activos', icon: 'support', tone: 'peach' },
  { key: 'secciones', label: 'Secciones del año', icon: 'sections', tone: 'lavender' },
]

function Icon({ name }: { name: string }) {
  const shared = {
    className: 'h-[18px] w-[18px] shrink-0',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.7,
  }

  switch (name) {
    case 'home':
      return <svg viewBox="0 0 24 24" {...shared}><path d="m3.5 10 8.5-7 8.5 7v10.5h-6v-7h-5v7h-6V10Z" /></svg>
    case 'teacher':
      return <svg viewBox="0 0 24 24" {...shared}><circle cx="9" cy="8" r="3.5" /><path d="M2.8 20c.4-3.5 2.5-5.5 6.2-5.5s5.8 2 6.2 5.5M16 5.2a3.5 3.5 0 0 1 0 6.7M17.2 14.8c2.5.5 3.8 2.2 4 5.2" /></svg>
    case 'support':
      return <svg viewBox="0 0 24 24" {...shared}><path d="M4 13v-2a8 8 0 0 1 16 0v2M4 12H3v5h4v-5H4Zm16 0h1v5h-4v-5h3ZM8 20h5a3 3 0 0 0 3-3" /></svg>
    case 'students':
      return <svg viewBox="0 0 24 24" {...shared}><path d="m3 8 9-4 9 4-9 4-9-4Z" /><path d="M6 10v5c3.5 3 8.5 3 12 0v-5M21 8v6" /><circle cx="21" cy="16" r="1" /></svg>
    case 'sections':
      return <svg viewBox="0 0 24 24" {...shared}><rect x="3.5" y="4" width="17" height="16" rx="2" /><path d="M8 8h8M8 12h8M8 16h4" /></svg>
    case 'grades':
      return <svg viewBox="0 0 24 24" {...shared}><path d="M4 20V9l8-5 8 5v11h-5v-6H9v6H4Z" /><path d="M8 10h.01M12 10h.01M16 10h.01" /></svg>
    case 'schedule':
      return <svg viewBox="0 0 24 24" {...shared}><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7.5 3v4M16.5 3v4M4 9.5h16M8 13h2M14 13h2M8 17h2" /></svg>
    case 'courses':
      return <svg viewBox="0 0 24 24" {...shared}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" /><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20M8 7h8M8 10h6" /></svg>
    case 'calendar':
      return <svg viewBox="0 0 24 24" {...shared}><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7.5 3v4M16.5 3v4M4 9.5h16M8 13h3M8 17h7" /></svg>
    case 'settings':
      return <svg viewBox="0 0 24 24" {...shared}><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1a1.7 1.7 0 1 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.3a1.7 1.7 0 1 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9h-.3a1.7 1.7 0 1 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2v-.3a1.7 1.7 0 1 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.3a1.7 1.7 0 1 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z" /></svg>
    case 'logout':
      return <svg viewBox="0 0 24 24" {...shared}><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 8l4 4-4 4M8 12h10" /></svg>
    case 'arrow':
      return <svg viewBox="0 0 24 24" {...shared}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
    case 'refresh':
      return <svg viewBox="0 0 24 24" {...shared}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9a7 7 0 0 1 11.8-2L20 12M4 12l2.7 5a7 7 0 0 0 11.8-2" /></svg>
    default:
      return null
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-PE').format(value)
}

export function DirectorDashboard({ usuario, error: authError, onSignOut }: DirectorDashboardProps) {
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [selectedModule, setSelectedModule] = useState<ManagementModule | null>(null)
  const {
    data: summary,
    isPending,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: dashboardSummaryKey,
    queryFn: getDashboardSummary,
  })

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await onSignOut()
    } finally {
      setIsSigningOut(false)
    }
  }

  const initials = `${usuario.nombres.charAt(0)}${usuario.apellidos.charAt(0)}`

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-16 flex-col border-r border-slate-200 bg-white px-2 py-4 sm:px-3 lg:w-60 lg:px-4">
        <a
          className="mb-7 flex items-center justify-center gap-2 px-1 text-xl font-extrabold tracking-tight text-emerald-950 lg:justify-start lg:px-2"
          href="/"
          aria-label="Asiste, inicio"
        >
          <BrandMark />
          <span className="hidden lg:inline">asiste<span className="text-emerald-500">.</span></span>
        </a>

        <div className="mb-6 hidden items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:flex">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-800 font-bold text-white">C</span>
          <span className="flex min-w-0 flex-1 flex-col">
            <strong className="truncate text-xs text-slate-700">Colegio</strong>
            <small className="mt-1 text-[10px] text-slate-500">Panel administrativo</small>
          </span>
        </div>

        <p className="mb-2 hidden px-3 text-[9px] font-bold tracking-[0.14em] text-slate-400 lg:block">MENÚ PRINCIPAL</p>
        <button
          className={`mb-1 flex h-11 items-center justify-center gap-3 rounded-lg px-2 text-sm font-semibold transition lg:justify-start lg:px-3 ${selectedModule === null ? 'bg-emerald-50 text-emerald-800' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
          onClick={() => setSelectedModule(null)}
          title="Resumen"
        >
          <Icon name="home" />
          <span className="hidden lg:inline">Resumen</span>
        </button>

        <p className="mb-2 mt-6 hidden px-3 text-[9px] font-bold tracking-[0.14em] text-slate-400 lg:block">GESTIÓN ESCOLAR</p>
        <nav className="flex flex-col gap-1" aria-label="Módulos de gestión">
          {managementItems.map((item) => (
            <button
              className={`flex h-11 items-center justify-center gap-3 rounded-lg px-2 text-sm transition lg:justify-start lg:px-3 ${selectedModule === item.id ? 'bg-emerald-50 font-semibold text-emerald-800' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
              key={item.id}
              onClick={() => setSelectedModule(item.id)}
              title={item.title}
            >
              <Icon name={item.icon} />
              <span className="hidden flex-1 text-left lg:inline">{item.title}</span>
              <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-[9px] text-slate-500 lg:inline">CRUD</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto">
          <div className="mb-3 hidden items-center gap-2 rounded-lg bg-slate-50 p-3 lg:flex">
            <span className="grid h-7 w-7 place-items-center rounded-full border border-emerald-100 text-sm text-emerald-700">?</span>
            <span className="flex flex-col">
              <strong className="text-[10px] text-slate-600">¿Necesitas ayuda?</strong>
              <small className="mt-0.5 text-[9px] text-slate-500">Contacta al administrador</small>
            </span>
          </div>
          <button
            className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border-t border-slate-100 px-2 text-xs font-medium text-slate-500 hover:text-rose-700 disabled:opacity-50 lg:justify-start lg:px-3"
            onClick={handleSignOut}
            disabled={isSigningOut}
            title="Cerrar sesión"
          >
            <Icon name="logout" />
            <span className="hidden lg:inline">{isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</span>
          </button>
        </div>
      </aside>

      <main className="ml-16 min-h-screen sm:ml-16 lg:ml-60" id="inicio">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-10">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Panel</span>
            <span>/</span>
            <strong className="font-semibold text-slate-700">{selectedModule ? moduleLabel(selectedModule) : 'Resumen'}</strong>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="hidden flex-col text-right sm:flex">
              <strong className="max-w-48 truncate text-xs font-semibold text-slate-700">{usuario.nombres} {usuario.apellidos}</strong>
              <span className="mt-0.5 text-[10px] text-slate-500">Director</span>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-emerald-100 bg-emerald-50 text-xs font-bold uppercase text-emerald-800">{initials}</span>
          </div>
        </header>

        {selectedModule ? (
          <Suspense
            fallback={
              <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">
                Abriendo módulo…
              </div>
            }
          >
            {selectedModule === 'matriculas' ? (
              <EnrollmentsPanel onBack={() => setSelectedModule(null)} />
            ) : (
              <DirectorManagement
                module={selectedModule}
                onBack={() => setSelectedModule(null)}
              />
            )}
          </Suspense>
        ) : (
          <div className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
            <section className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <span className="text-[10px] font-bold tracking-[0.16em] text-emerald-700">PANEL DEL DIRECTOR</span>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Buenos días, {usuario.nombres}</h1>
                <p className="mt-2 text-sm text-slate-500">Este es el resumen de la gestión de tu colegio.</p>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs capitalize text-slate-600">
                <Icon name="schedule" />
                {dateLabel}
              </div>
            </section>

            {authError && (
              <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
                {authError}
              </div>
            )}

            <section className="mb-8" aria-labelledby="summary-title">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h2 id="summary-title" className="text-base font-bold text-slate-800">Resumen general</h2>
                  <p className="mt-1 text-xs text-slate-500">Información actual de la comunidad escolar</p>
                </div>
                <button
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:border-emerald-200 hover:text-emerald-800 disabled:opacity-50"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                >
                  <Icon name="refresh" />
                  <span className="hidden sm:inline">Actualizar</span>
                </button>
              </div>

              {error && (
                <div className="mb-4 flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between" role="alert">
                  <span>{error.message || 'No se pudo cargar el resumen del colegio.'}</span>
                  <button className="font-semibold underline" onClick={() => void refetch()}>Reintentar</button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {statCards.map((card) => (
                  <article className="flex min-h-28 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" key={card.key}>
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${card.tone === 'mint' ? 'bg-emerald-50 text-emerald-700' : card.tone === 'blue' ? 'bg-blue-50 text-blue-700' : card.tone === 'peach' ? 'bg-orange-50 text-orange-700' : 'bg-violet-50 text-violet-700'}`}>
                      <Icon name={card.icon} />
                    </div>
                    <div className="flex min-w-0 flex-col gap-2">
                      <span className="text-xs text-slate-500">{card.label}</span>
                      <strong className="text-2xl font-bold tracking-tight text-slate-800">
                        {isPending ? <span className="inline-block h-5 w-10 animate-pulse rounded bg-slate-100" /> : formatNumber(summary?.[card.key] ?? 0)}
                      </strong>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 sm:divide-x sm:divide-slate-100">
                <div className="flex items-center gap-3 sm:px-2">
                  <span className="text-violet-700"><Icon name="grades" /></span>
                  <span className="flex-1 text-xs text-slate-500">Grados registrados</span>
                  <strong className="text-sm font-bold text-slate-800">{isPending ? '—' : formatNumber(summary?.grados ?? 0)}</strong>
                </div>
                <div className="flex items-center gap-3 border-t border-slate-100 pt-3 sm:border-0 sm:px-5 sm:pt-0">
                  <span className="text-emerald-700"><Icon name="schedule" /></span>
                  <span className="flex-1 text-xs text-slate-500">Bloques de horario activos</span>
                  <strong className="text-sm font-bold text-slate-800">{isPending ? '—' : formatNumber(summary?.horarios ?? 0)}</strong>
                </div>
              </div>
            </section>

            <section className="mb-8" aria-labelledby="management-title">
              <div className="mb-4">
                <h2 id="management-title" className="text-base font-bold text-slate-800">Gestión escolar</h2>
                <p className="mt-1 text-xs text-slate-500">Administra las áreas principales de tu institución</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {managementItems.map((item, index) => (
                  <button
                    className="group flex min-h-24 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
                    key={item.id}
                    onClick={() => setSelectedModule(item.id)}
                  >
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${['bg-blue-50 text-blue-700', 'bg-orange-50 text-orange-700', 'bg-emerald-50 text-emerald-700', 'bg-violet-50 text-violet-700', 'bg-amber-50 text-amber-700', 'bg-teal-50 text-teal-700'][index]}`}>
                      <Icon name={item.icon} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm font-semibold text-slate-800">{item.title}</strong>
                      <small className="mt-1 block text-xs leading-relaxed text-slate-500">{item.detail}</small>
                    </span>
                    <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-700">
                      <Icon name="arrow" />
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <footer className="flex justify-between border-t border-slate-200 pt-4 text-[10px] text-slate-400">
              <span>Asiste <b className="text-emerald-500">·</b> Gestión escolar</span>
              <span>Acceso de administrador</span>
            </footer>
          </div>
        )}
      </main>
    </div>
  )
}

function moduleLabel(module: ManagementModule): string {
  return managementItems.find((item) => item.id === module)?.title ?? 'Gestión'
}

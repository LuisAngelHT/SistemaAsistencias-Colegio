import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell, Camera, Check, CircleCheck, Clock3, LogOut, QrCode, RefreshCw,
  School, Search, X,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Usuario } from '../auth/types'
import { BrandMark } from '../auth/BrandMark'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import {
  getSectionAttendance,
  getSectionEnrollments,
  getSections,
  limaToday,
  markStudentAttendance,
  scanStudentCode,
  type ScanResult,
  type SectionAttendance,
} from './auxiliaryService'

const QrScanner = lazy(() => import('./QrScanner').then((module) => ({ default: module.QrScanner })))
const sectionsKey = ['auxiliary', 'sections'] as const
const enrollmentsKey = (sectionId: number) => ['auxiliary', 'enrollments', sectionId] as const
const attendanceKey = (sectionId: number) => ['auxiliary', 'entry-attendance', sectionId] as const
const todayLabel = new Intl.DateTimeFormat('es-PE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Lima',
}).format(new Date())

function sectionLabel(section: { nombre: string; grado: { nombre: string; nivel: string } }) {
  return `${section.grado.nivel} · ${section.grado.nombre} · Sección ${section.nombre}`
}

function showScanToast(result: ScanResult) {
  const title = `${result.alumno.nombres} ${result.alumno.apellidos}`
  if (result.resultado === 'ya_registrado') {
    toast.warning(`${title}: ${result.mensaje}`)
  } else {
    toast.success(`${title}: ${result.mensaje}`, {
      description: `${result.seccion} · ${result.hora}`,
    })
  }
}

export function AuxiliaryDashboard({
  usuario,
  onSignOut,
}: {
  usuario: Usuario
  onSignOut: () => Promise<void>
}) {
  const queryClient = useQueryClient()
  const [selectedSectionPreference, setSelectedSectionId] = useState<number | null>(null)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const seenAttendance = useRef<Map<number, Set<string>>>(new Map())
  const sectionsQuery = useQuery({ queryKey: sectionsKey, queryFn: getSections })
  const sections = sectionsQuery.data ?? []
  const selectedSectionId = selectedSectionPreference ?? sections[0]?.id ?? null
  const selectedSection = sections.find((section) => section.id === selectedSectionId)
  const attendanceQueries = useQueries({
    queries: sections.map((section) => ({
      queryKey: attendanceKey(section.id),
      queryFn: () => getSectionAttendance(section.id),
      refetchInterval: 4000,
      refetchIntervalInBackground: true,
    })),
  })
  const attendanceQueryIndex = sections.findIndex((section) => section.id === selectedSectionId)
  const attendanceQuery = attendanceQueries[attendanceQueryIndex]
  const enrollmentsQuery = useQuery({
    queryKey: enrollmentsKey(selectedSectionId ?? 0),
    queryFn: () => getSectionEnrollments(selectedSectionId!),
    enabled: selectedSectionId !== null,
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  })
  const attendance: SectionAttendance | undefined = attendanceQuery?.data
  const presentCount = (attendance?.presentes ?? 0) + (attendance?.tardanzas ?? 0)
  const activeEnrollments = (enrollmentsQuery.data ?? []).filter(
    (enrollment) => enrollment.estado === 'activa',
  )
  const attendanceByStudent = new Map(
    (attendance?.alumnos ?? []).map((row) => [row.matriculaId, row]),
  )
  const visibleEnrollments = useMemo(() => {
    const term = studentSearch.trim().toLocaleLowerCase()
    if (!term) return activeEnrollments
    return activeEnrollments.filter(({ alumno }) =>
      `${alumno.nombres} ${alumno.apellidos} ${alumno.codigo}`.toLocaleLowerCase().includes(term),
    )
  }, [activeEnrollments, studentSearch])

  useEffect(() => {
    for (const query of attendanceQueries) {
      const sectionAttendance = query.data
      if (!sectionAttendance) continue
      const currentAttendance = new Set(
        sectionAttendance.alumnos
          .filter((row) => row.estado)
          .map((row) => row.matriculaId),
      )
      const seenInSection = seenAttendance.current.get(sectionAttendance.seccionId)
      if (seenInSection) {
        for (const row of sectionAttendance.alumnos) {
          if (
            !row.estado
            || row.metodo !== 'qr_camara'
            || seenInSection.has(row.matriculaId)
          ) continue
          toast.success(`Asistencia registrada: ${row.alumno.nombres} ${row.alumno.apellidos}`, {
            description: `${row.estado} · ${row.hora ?? ''}`,
          })
        }
      }
      seenAttendance.current.set(sectionAttendance.seccionId, currentAttendance)
    }
  }, [attendanceQueries])

  const refreshAttendance = () => {
    void queryClient.invalidateQueries({ queryKey: ['auxiliary', 'entry-attendance'] })
    void queryClient.invalidateQueries({ queryKey: ['auxiliary', 'enrollments'] })
  }

  const handleScan = async (rawValue: string) => {
    setIsScanning(true)
    setIsScannerOpen(false)
    try {
      const code = rawValue.trim()
      if (!code) throw new Error('El código QR está vacío.')
      const result = await scanStudentCode(code)
      showScanToast(result)
      refreshAttendance()
    } catch (scanError) {
      toast.error(scanError instanceof Error ? scanError.message : 'No se pudo registrar el ingreso.')
    } finally {
      setIsScanning(false)
    }
  }

  const handleManualAttendance = async (matriculaId: string, state: 'presente' | 'falta') => {
    setPendingIds((current) => [...current, matriculaId])
    try {
      await markStudentAttendance(matriculaId, state)
      toast.success(state === 'presente' ? 'Asistencia marcada como presente.' : 'Asistencia marcada como falta.')
      await queryClient.invalidateQueries({ queryKey: attendanceKey(selectedSectionId ?? 0) })
    } catch (manualError) {
      toast.error(manualError instanceof Error ? manualError.message : 'No se pudo registrar la asistencia.')
    } finally {
      setPendingIds((current) => current.filter((id) => id !== matriculaId))
    }
  }

  const signOut = async () => {
    setIsSigningOut(true)
    try {
      await onSignOut()
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-10">
        <a className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-emerald-950" href="/" aria-label="Asiste, inicio">
          <BrandMark />
          <span>asiste<span className="text-emerald-500">.</span></span>
        </a>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden text-xs font-medium text-slate-600 sm:inline">Auxiliar</span>
          <span className="grid size-9 place-items-center rounded-full border-2 border-emerald-100 bg-emerald-50 text-xs font-bold uppercase text-emerald-800">
            {usuario.nombres.charAt(0)}{usuario.apellidos.charAt(0)}
          </span>
          <Button variant="outline" size="sm" onClick={() => void signOut()} disabled={isSigningOut}>
            <LogOut aria-hidden="true" />
            <span className="hidden sm:inline">{isSigningOut ? 'Saliendo…' : 'Cerrar sesión'}</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        <section className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Panel del auxiliar</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Control de asistencia</h1>
            <p className="mt-2 text-sm text-slate-500">Escanea el QR al ingreso o registra la asistencia manualmente.</p>
          </div>
          <div className="flex items-center gap-2 text-xs capitalize text-slate-500">
            <Clock3 className="size-4 text-emerald-700" />
            {todayLabel}
          </div>
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-4">
              <span className="hidden size-12 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800 sm:grid">
                <QrCode className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-slate-900">Registrar ingreso con QR</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  En el celular, abre el lector y centra el código del alumno. El panel de escritorio se actualiza automáticamente.
                </p>
                <Button className="mt-4 h-11 w-full sm:w-auto" onClick={() => setIsScannerOpen(true)} disabled={isScanning}>
                  <Camera aria-hidden="true" />
                  {isScanning ? 'Registrando ingreso…' : 'Abrir lector de QR'}
                </Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold text-emerald-800"><CircleCheck className="size-4" /> Ingresos registrados hoy</p>
              <strong className="mt-2 block text-3xl font-bold text-emerald-950">{attendance?.total === undefined ? '—' : presentCount}</strong>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold text-amber-800"><Bell className="size-4" /> Pendientes</p>
              <strong className="mt-2 block text-3xl font-bold text-amber-950">{attendance?.sinRegistrar ?? '—'}</strong>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 className="font-semibold text-slate-900">Registro manual y actividad en vivo</h2>
              <p className="mt-1 text-xs text-slate-500">La tabla consulta nuevos ingresos cada 4 segundos.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="block sm:min-w-64">
                <span className="sr-only">Sección</span>
                <select
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                  value={selectedSectionId ?? ''}
                  disabled={sectionsQuery.isPending}
                  onChange={(event) => {
                    setSelectedSectionId(event.target.value ? Number(event.target.value) : null)
                  }}
                >
                  <option value="">{sectionsQuery.isPending ? 'Cargando secciones…' : 'Selecciona una sección'}</option>
                  {sections.map((section) => (
                    <option value={section.id} key={section.id}>{sectionLabel(section)}</option>
                  ))}
                </select>
              </label>
              <label className="relative block sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Input
                  className="h-10 pl-9"
                  placeholder="Buscar alumno…"
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  disabled={!selectedSectionId}
                />
              </label>
              <Button variant="outline" size="icon" aria-label="Actualizar asistencia" onClick={refreshAttendance} disabled={attendanceQuery?.isFetching}>
                <RefreshCw className={attendanceQuery?.isFetching ? 'animate-spin' : ''} />
              </Button>
            </div>
          </header>

          {(sectionsQuery.error || enrollmentsQuery.error || attendanceQuery?.error) && (
            <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
              {(sectionsQuery.error ?? enrollmentsQuery.error ?? attendanceQuery?.error)?.message}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-bold tracking-wider text-slate-500">ALUMNO</th>
                  <th className="px-5 py-3 text-[10px] font-bold tracking-wider text-slate-500">ESTADO HOY</th>
                  <th className="px-5 py-3 text-[10px] font-bold tracking-wider text-slate-500">HORA / MÉTODO</th>
                  <th className="px-5 py-3 text-right text-[10px] font-bold tracking-wider text-slate-500">REGISTRAR MANUAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedSectionId && (enrollmentsQuery.isPending || attendanceQuery.isPending) ? (
                  <tr><td colSpan={4} className="px-5 py-14 text-center text-sm text-slate-500">Cargando alumnos y asistencias…</td></tr>
                ) : visibleEnrollments.map((enrollment) => {
                  const row = attendanceByStudent.get(enrollment.id)
                  const isPending = pendingIds.includes(enrollment.id)
                  return (
                    <tr key={enrollment.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <strong className="block text-sm font-medium text-slate-800">{enrollment.alumno.nombres} {enrollment.alumno.apellidos}</strong>
                        <span className="mt-1 block text-xs text-slate-500">Código: {enrollment.alumno.codigo}</span>
                      </td>
                      <td className="px-5 py-4">
                        {row?.estado ? (
                          <Badge variant={row.estado === 'falta' ? 'destructive' : 'default'}>
                            {row.estado === 'tardanza' ? 'Tardanza' : row.estado === 'falta' ? 'Falta' : 'Presente'}
                          </Badge>
                        ) : <span className="text-xs text-slate-400">Sin registrar</span>}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {row?.hora ? `${row.hora} · ${row.metodo === 'qr_camara' ? 'QR' : 'Manual'}` : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant={row?.estado && ['presente', 'tardanza'].includes(row.estado) ? 'default' : 'outline'}
                            className="text-emerald-800"
                            disabled={isPending}
                            aria-label={`Marcar presente a ${enrollment.alumno.nombres} ${enrollment.alumno.apellidos}`}
                            onClick={() => void handleManualAttendance(enrollment.id, 'presente')}
                          >
                            <Check aria-hidden="true" />
                            <span className="hidden sm:inline">Presente</span>
                          </Button>
                          <Button
                            size="sm"
                            variant={row?.estado === 'falta' ? 'destructive' : 'outline'}
                            className={row?.estado === 'falta' ? '' : 'text-rose-700'}
                            disabled={isPending}
                            aria-label={`Marcar falta a ${enrollment.alumno.nombres} ${enrollment.alumno.apellidos}`}
                            onClick={() => void handleManualAttendance(enrollment.id, 'falta')}
                          >
                            <X aria-hidden="true" />
                            <span className="hidden sm:inline">Falta</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!sectionsQuery.isPending && sections.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-14 text-center text-sm text-slate-500">No hay secciones en el año académico activo.</td></tr>
                )}
                {selectedSection && !enrollmentsQuery.isPending && visibleEnrollments.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-14 text-center text-sm text-slate-500">
                    {studentSearch
                      ? 'No hay alumnos que coincidan con la búsqueda.'
                      : 'Esta sección no tiene alumnos con matrícula activa. Inscribe al alumno desde Dirección → Matrículas.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5">
            <span className="flex items-center gap-2">
              <School className="size-4" />
              {selectedSection ? sectionLabel(selectedSection) : 'Selecciona una sección'}
            </span>
            <span>{attendance?.fecha ?? limaToday()}</span>
          </footer>
        </section>
      </main>

      {isScannerOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-50 grid place-items-center bg-slate-950 text-white">Preparando lector…</div>}>
          <QrScanner onCode={(code) => void handleScan(code)} onClose={() => setIsScannerOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}

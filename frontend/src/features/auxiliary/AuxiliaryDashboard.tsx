import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell, Camera, Check, CircleCheck, Clock3, LogOut, QrCode, RefreshCw, Save, Settings2,
  School, Search,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Usuario } from '../auth/types'
import { BrandMark } from '../auth/BrandMark'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import {
  getPendingRequestCount,
  pendingRequestCountKey,
} from '../attendance/justificationRequestsService'
import {
  getSectionAttendance,
  getSectionEnrollments,
  getSections,
  getEntryConfiguration,
  updateEntryConfiguration,
  limaToday,
  markStudentAttendance,
  scanStudentCode,
  type ScanResult,
  type SectionAttendance,
  type EntryConfiguration,
} from './auxiliaryService'

const QrScanner = lazy(() => import('./QrScanner').then((module) => ({ default: module.QrScanner })))
const FamilyRequestsPanel = lazy(() =>
  import('../attendance/FamilyRequestsPanel').then((module) => ({
    default: module.FamilyRequestsPanel,
  })),
)
const sectionsKey = ['auxiliary', 'sections'] as const
const enrollmentsKey = (sectionId: number) => ['auxiliary', 'enrollments', sectionId] as const
const attendanceKey = (sectionId: number) => ['auxiliary', 'entry-attendance', sectionId] as const
const entryConfigurationKey = ['auxiliary', 'entry-configuration'] as const
const todayLabel = new Intl.DateTimeFormat('es-PE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Lima',
}).format(new Date())

function sectionLabel(section: { nombre: string; grado: { nombre: string; nivel: string } }) {
  return `${section.grado.nivel} · ${section.grado.nombre} · Sección ${section.nombre}`
}

function currentClock() {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date())
}

function EntryTimeSettings({
  configuration,
}: {
  configuration: EntryConfiguration
}) {
  const queryClient = useQueryClient()
  const [horaIngreso, setHoraIngreso] = useState(configuration.horaIngreso.slice(0, 5))
  const [toleranciaMin, setToleranciaMin] = useState(String(configuration.toleranciaMin))
  const [horaLimite, setHoraLimite] = useState(configuration.horaLimite.slice(0, 5))
  const [isSaving, setIsSaving] = useState(false)

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const tolerance = Number(toleranciaMin)
    if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 180) {
      toast.error('La tolerancia debe estar entre 0 y 180 minutos.')
      return
    }
    const timeToSeconds = (value: string) => {
      const [hours, minutes] = value.split(':').map(Number)
      return hours * 3600 + minutes * 60
    }
    if (timeToSeconds(horaLimite) <= timeToSeconds(horaIngreso) + tolerance * 60) {
      toast.error('La hora límite debe ser posterior al fin de la tolerancia.')
      return
    }

    setIsSaving(true)
    try {
      const saved = await updateEntryConfiguration({
        horaIngreso,
        toleranciaMin: tolerance,
        horaLimite,
      })
      setHoraIngreso(saved.horaIngreso.slice(0, 5))
      setToleranciaMin(String(saved.toleranciaMin))
      setHoraLimite(saved.horaLimite.slice(0, 5))
      queryClient.setQueryData(entryConfigurationKey, saved)
      await queryClient.invalidateQueries({ queryKey: ['auxiliary', 'entry-attendance'] })
      toast.success('Horario general de ingreso actualizado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el horario.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Settings2 className="size-5 text-emerald-700" aria-hidden="true" />
        <div>
          <h2 className="font-semibold text-slate-900">Horario general de ingreso</h2>
          <p className="mt-1 text-xs text-slate-500">Aplica al ingreso al colegio: después de la tolerancia se marca tardanza y, al llegar la hora límite, se registra falta automáticamente para quienes no tengan ingreso.</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block flex-1 text-sm font-medium text-slate-700">
          Hora de ingreso
          <Input
            className="mt-1"
            type="time"
            required
            value={horaIngreso}
            onChange={(event) => setHoraIngreso(event.target.value)}
            disabled={isSaving}
          />
        </label>
        <label className="block flex-1 text-sm font-medium text-slate-700">
          Tolerancia (minutos)
          <Input
            className="mt-1"
            type="number"
            min={0}
            max={180}
            step={1}
            required
            value={toleranciaMin}
            onChange={(event) => setToleranciaMin(event.target.value)}
            disabled={isSaving}
          />
        </label>
        <label className="block flex-1 text-sm font-medium text-slate-700">
          Hora límite para registrar ingreso
          <Input
            className="mt-1"
            type="time"
            required
            value={horaLimite}
            onChange={(event) => setHoraLimite(event.target.value)}
            disabled={isSaving}
          />
        </label>
        <Button type="submit" disabled={isSaving}>
          <Save aria-hidden="true" />
          {isSaving ? 'Guardando…' : 'Guardar horario'}
        </Button>
      </div>
    </form>
  )
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
  const [showFamilyRequests, setShowFamilyRequests] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const [clock, setClock] = useState(currentClock)
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
  const pendingRequestsQuery = useQuery({
    queryKey: pendingRequestCountKey,
    queryFn: getPendingRequestCount,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  })
  const entryConfigurationQuery = useQuery({
    queryKey: entryConfigurationKey,
    queryFn: getEntryConfiguration,
  })
  const attendance: SectionAttendance | undefined = attendanceQuery?.data
  const entryConfiguration = entryConfigurationQuery.data
  const currentTime = clock
  const finTolerancia = entryConfiguration
    ? (() => {
        const [hours, minutes] = entryConfiguration.horaIngreso.split(':').map(Number)
        const total = hours * 60 + minutes + entryConfiguration.toleranciaMin
        return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
      })()
    : null
  const ingresoPuntual = Boolean(finTolerancia && currentTime <= `${finTolerancia}:00`)
  const antesHoraLimite = Boolean(entryConfiguration && currentTime < entryConfiguration.horaLimite.slice(0, 5))
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
    const intervalId = window.setInterval(() => setClock(currentClock()), 1000)
    return () => window.clearInterval(intervalId)
  }, [])

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

  const handleManualAttendance = async (matriculaId: string, state: 'presente' | 'tardanza' | 'falta') => {
    setPendingIds((current) => [...current, matriculaId])
    try {
      await markStudentAttendance(matriculaId, state)
      toast.success(`Asistencia marcada como ${state}.`)
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

  if (showFamilyRequests) {
    return (
      <Suspense fallback={<div className="p-12 text-center text-sm text-slate-500">Abriendo solicitudes…</div>}>
        <FamilyRequestsPanel onBack={() => setShowFamilyRequests(false)} />
      </Suspense>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-10">
        <a className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-emerald-950" href="/" aria-label="SIGA, inicio">
          <BrandMark />
          <span>SIGA</span>
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFamilyRequests(true)}
              aria-label={pendingRequestsQuery.isError
                ? 'Solicitudes familiares: no se pudo cargar el contador'
                : `Solicitudes familiares: ${pendingRequestsQuery.data ?? 0} pendientes`}
              title={pendingRequestsQuery.error?.message ?? 'Solicitudes familiares pendientes'}
            >
              <span className="relative">
                <Bell aria-hidden="true" />
                <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-4 text-white">
                  {pendingRequestsQuery.isError ? '!' : pendingRequestsQuery.data ?? '…'}
                </span>
              </span>
              <span className="hidden sm:inline">Solicitudes familiares</span>
            </Button>
            <div className="flex items-center gap-2 text-xs capitalize text-slate-500">
              <Clock3 className="size-4 text-emerald-700" />
              <span>{todayLabel}</span>
              <strong className="font-mono tabular-nums text-slate-800">{clock}</strong>
            </div>
          </div>
        </section>

        {entryConfigurationQuery.data ? (
          <EntryTimeSettings
            key={entryConfigurationQuery.data.updatedAt}
            configuration={entryConfigurationQuery.data}
          />
        ) : entryConfigurationQuery.isPending ? (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
            Cargando configuración de ingreso…
          </div>
        ) : (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
            {entryConfigurationQuery.error?.message ?? 'No se pudo cargar el horario general de ingreso.'}
            <Button className="ml-3" variant="outline" size="sm" onClick={() => void entryConfigurationQuery.refetch()}>
              Reintentar
            </Button>
          </div>
        )}

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
                            {row.estado === 'tardanza'
                              ? 'Tardanza'
                              : row.estado === 'falta'
                                ? 'Falta'
                                : row.estado === 'falta_justificada'
                                  ? 'Falta justificada'
                                  : row.estado === 'tardanza_justificada'
                                    ? 'Tardanza justificada'
                                    : 'Presente'}
                          </Badge>
                        ) : <span className="text-xs text-slate-400">Sin registrar</span>}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {row?.hora
                          ? `${row.hora} · ${row.metodo === 'qr_camara' ? 'QR' : 'Manual'}`
                          : row?.observacion ?? '—'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {row?.estado === 'presente' ? (
                            <span className="text-xs font-medium text-emerald-700">Ingreso registrado</span>
                          ) : row?.estado === 'tardanza' ? (
                            <span className="text-xs font-medium text-amber-700">Ingreso tardío registrado</span>
                          ) : (
                            <>
                              {!row?.estado && ingresoPuntual && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-800"
                                disabled={isPending}
                                aria-label={`Marcar presente a ${enrollment.alumno.nombres} ${enrollment.alumno.apellidos}`}
                                onClick={() => void handleManualAttendance(enrollment.id, 'presente')}
                              >
                                <Check aria-hidden="true" />
                                <span className="hidden sm:inline">Presente</span>
                              </Button>
                              )}
                              {(!row?.estado && !ingresoPuntual && antesHoraLimite
                                || row?.estado === 'falta') && <Button
                                size="sm"
                                variant="outline"
                                className="text-amber-800"
                                disabled={isPending}
                                aria-label={`Registrar tardanza a ${enrollment.alumno.nombres} ${enrollment.alumno.apellidos}`}
                                onClick={() => void handleManualAttendance(enrollment.id, 'tardanza')}
                              >
                                <Clock3 aria-hidden="true" />
                                <span className="hidden sm:inline">{row?.estado === 'falta' ? 'Registrar tardanza' : 'Tardanza'}</span>
                              </Button>}
                              {!row?.estado && !entryConfiguration && (
                                <span className="text-xs text-slate-500">Cargando horario de ingreso…</span>
                              )}
                              {!row?.estado && entryConfiguration && !ingresoPuntual && !antesHoraLimite && (
                                <span className="text-xs text-slate-500">Registrando falta automáticamente…</span>
                              )}
                            </>
                          )}
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

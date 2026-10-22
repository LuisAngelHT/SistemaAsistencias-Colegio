import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen, CalendarDays, Check, CheckCheck, Clock3, LogOut, Users, X,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Usuario } from '../auth/types'
import { BrandMark } from '../auth/BrandMark'
import { Button } from '../../components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog'
import {
  getClassAttendance,
  getTeacherSchedules,
  limaToday,
  limaWeekday,
  saveClassAttendance,
  timeLabel,
  weekdayLabel,
  type AttendanceState,
  type ClassAttendance,
  type TeacherSchedule,
} from './teacherService'

type TeacherDashboardProps = {
  usuario: Usuario
  onSignOut: () => Promise<void>
}

const schedulesKey = ['teacher', 'schedules'] as const
const todayLabel = new Intl.DateTimeFormat('es-PE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Lima',
}).format(new Date())
const attendanceKey = (horarioId: number, date: string) =>
  ['teacher', 'class-attendance', horarioId, date] as const

function initials(student: ClassAttendance['alumnos'][number]['alumno']) {
  return `${student.nombres.charAt(0)}${student.apellidos.charAt(0)}`.toUpperCase()
}

function AttendanceDialog({
  schedule,
  onClose,
}: {
  schedule: TeacherSchedule
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [date] = useState(limaToday)
  const [stateOverrides, setStateOverrides] = useState<
    Record<string, Record<string, AttendanceState | null>>
  >({})
  const [isSaving, setIsSaving] = useState(false)
  const { data, isPending, error } = useQuery({
    queryKey: attendanceKey(schedule.id, date),
    queryFn: () => getClassAttendance(schedule.id, date),
  })

  const stateKey = `${schedule.id}-${date}`
  const states = stateOverrides[stateKey] ?? Object.fromEntries(
    (data?.alumnos ?? []).map((row) => [row.matriculaId, row.estado]),
  )

  const presentCount = Object.values(states).filter((state) => state === 'presente').length
  const absentCount = Object.values(states).filter((state) => state === 'falta').length
  const completedCount = presentCount + absentCount
  const allMarked = Boolean(data?.alumnos.length) && completedCount === data?.alumnos.length

  const markAllPresent = () => {
    if (!data) return
    setStateOverrides((current) => ({
      ...current,
      [stateKey]: Object.fromEntries(data.alumnos.map((row) => [row.matriculaId, 'presente'])),
    }))
  }

  const setStudentState = (matriculaId: string, state: AttendanceState) => {
    setStateOverrides((current) => ({
      ...current,
      [stateKey]: { ...states, [matriculaId]: state },
    }))
  }

  const save = async () => {
    if (!data || !allMarked) return
    setIsSaving(true)
    try {
      await saveClassAttendance(schedule.id, date, data.alumnos.map((row) => ({
        matriculaId: row.matriculaId,
        estado: states[row.matriculaId] as AttendanceState,
      })))
      await queryClient.invalidateQueries({ queryKey: attendanceKey(schedule.id, date) })
      toast.success('Asistencia de la clase guardada.')
      onClose()
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'No se pudo guardar la asistencia.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7">
          <div className="min-w-0">
            <DialogTitle className="text-xl">{schedule.curso.nombre}</DialogTitle>
            <DialogDescription className="mt-1">
              {schedule.seccion.grado.nombre} · Sección {schedule.seccion.nombre}
            </DialogDescription>
          </div>
          <DialogClose aria-label="Cerrar lista"><X className="size-5" /></DialogClose>
        </header>

        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <CalendarDays className="size-4 text-emerald-700" />
            Fecha
            <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{todayLabel}</span>
          </label>
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="text-emerald-700"><Check className="mr-1 inline size-3.5" />{presentCount} presentes</span>
            <span className="text-rose-700"><X className="mr-1 inline size-3.5" />{absentCount} ausentes</span>
            {data && (
              <Button variant="outline" size="sm" onClick={markAllPresent} disabled={!data.alumnos.length}>
                <CheckCheck aria-hidden="true" />
                Todos presentes
              </Button>
            )}
          </div>
        </div>

        <div className="min-h-56 overflow-y-auto px-5 py-2 sm:px-7">
          {isPending && <p className="py-16 text-center text-sm text-slate-500">Cargando lista de alumnos…</p>}
          {error && (
            <p className="my-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
              {error.message}
            </p>
          )}
          {!isPending && data?.alumnos.length === 0 && (
            <div className="py-16 text-center">
              <Users className="mx-auto size-8 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">Esta sección no tiene alumnos activos</p>
            </div>
          )}
          {data?.alumnos.map((row, index) => (
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-3 last:border-0" key={row.matriculaId}>
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-50 text-xs font-bold text-emerald-800">
                {row.alumno.fotoUrl
                  ? <img className="size-full object-cover" src={row.alumno.fotoUrl} alt="" />
                  : initials(row.alumno)}
              </span>
              <span className="min-w-36 flex-1">
                <strong className="block text-sm font-semibold text-slate-800">
                  {index + 1}. {row.alumno.nombres} {row.alumno.apellidos}
                </strong>
                <small className="mt-0.5 block text-xs text-slate-500">Código: {row.alumno.codigo}</small>
              </span>
              <div className="flex gap-2" role="group" aria-label={`Asistencia de ${row.alumno.nombres} ${row.alumno.apellidos}`}>
                <Button
                  type="button"
                  size="sm"
                  variant={states[row.matriculaId] === 'presente' ? 'default' : 'outline'}
                  aria-pressed={states[row.matriculaId] === 'presente'}
                  onClick={() => setStudentState(row.matriculaId, 'presente')}
                  className={states[row.matriculaId] === 'presente' ? 'bg-emerald-700' : 'text-emerald-800'}
                >
                  <Check aria-hidden="true" />
                  Presente
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={states[row.matriculaId] === 'falta' ? 'destructive' : 'outline'}
                  aria-pressed={states[row.matriculaId] === 'falta'}
                  onClick={() => setStudentState(row.matriculaId, 'falta')}
                  className={states[row.matriculaId] === 'falta' ? '' : 'text-rose-700'}
                >
                  <X aria-hidden="true" />
                  Ausente
                </Button>
              </div>
            </div>
          ))}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <p className="text-xs text-slate-500">
            {data ? `${completedCount} de ${data.alumnos.length} alumnos marcados` : 'Marca la asistencia de la sección'}
          </p>
          <div className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => void save()} disabled={!allMarked || isSaving || isPending}>
              {isSaving ? 'Guardando…' : 'Guardar asistencia'}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  )
}

export function TeacherDashboard({ usuario, onSignOut }: TeacherDashboardProps) {
  const [selectedSchedule, setSelectedSchedule] = useState<TeacherSchedule | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const { data: schedules = [], isPending, error, refetch, isFetching } = useQuery({
    queryKey: schedulesKey,
    queryFn: getTeacherSchedules,
  })

  const todayDay = limaWeekday()
  const todaySchedules = useMemo(
    () => schedules.filter((schedule) => schedule.diaSemana === todayDay),
    [schedules, todayDay],
  )
  const assignedCourses = new Set(schedules.map((schedule) => schedule.curso.id)).size
  const assignedSections = new Set(schedules.map((schedule) => schedule.seccion.id)).size
  const assignedGrades = new Set(schedules.map((schedule) => schedule.seccion.grado.id)).size
  const initialsLabel = `${usuario.nombres.charAt(0)}${usuario.apellidos.charAt(0)}`

  const signOut = async () => {
    setIsSigningOut(true)
    try {
      await onSignOut()
    } finally {
      setIsSigningOut(false)
    }
  }

  const renderSchedule = (schedule: TeacherSchedule) => (
    <article key={schedule.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800">
          <BookOpen className="size-5" aria-hidden="true" />
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {weekdayLabel(schedule.diaSemana)}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-900">{schedule.curso.nombre}</h3>
      <p className="mt-1 text-sm text-slate-600">
        {schedule.seccion.grado.nombre} · Sección {schedule.seccion.nombre}
      </p>
      <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Clock3 className="size-4" aria-hidden="true" />
        {timeLabel(schedule.horaInicio)} – {timeLabel(schedule.horaFin)}
      </p>
      <Button className="mt-5 w-full" onClick={() => setSelectedSchedule(schedule)}>
        <Users aria-hidden="true" />
        Pasar lista
      </Button>
    </article>
  )

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-10">
        <a className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-emerald-950" href="/" aria-label="Asiste, inicio">
          <BrandMark />
          <span>asiste<span className="text-emerald-500">.</span></span>
        </a>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs font-medium text-slate-600 sm:inline">Profesor</span>
          <span className="grid size-9 place-items-center rounded-full border-2 border-emerald-100 bg-emerald-50 text-xs font-bold uppercase text-emerald-800">
            {initialsLabel}
          </span>
          <Button variant="outline" size="sm" onClick={() => void signOut()} disabled={isSigningOut}>
            <LogOut aria-hidden="true" />
            <span className="hidden sm:inline">{isSigningOut ? 'Saliendo…' : 'Cerrar sesión'}</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <section className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Panel del profesor</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Hola, {usuario.nombres}
            </h1>
            <p className="mt-2 text-sm text-slate-500">Revisa tus cursos y toma asistencia de tus secciones.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs capitalize text-slate-600">
            <CalendarDays className="size-4 text-emerald-700" aria-hidden="true" />
            {todayLabel}
          </div>
        </section>

        <section className="mb-9 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Cursos asignados', count: assignedCourses, icon: BookOpen },
            { label: 'Grados', count: assignedGrades, icon: CalendarDays },
            { label: 'Secciones', count: assignedSections, icon: Users },
          ].map(({ label, count, icon: Icon }) => (
            <div key={label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><Icon className="size-5" /></span>
              <span>
                <strong className="block text-xl font-bold text-slate-900">{isPending ? '—' : count}</strong>
                <small className="text-xs text-slate-500">{label}</small>
              </span>
            </div>
          ))}
        </section>

        {error && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
            <span>{error.message}</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>Reintentar</Button>
          </div>
        )}

        <section className="mb-10">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Clases de hoy</h2>
              <p className="mt-1 text-xs text-slate-500">Accede a la lista para registrar la asistencia por curso.</p>
            </div>
          </div>
          {isPending ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-56 animate-pulse rounded-2xl bg-slate-200" />)}
            </div>
          ) : todaySchedules.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{todaySchedules.map(renderSchedule)}</div>
          ) : !error ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <CalendarDays className="mx-auto size-9 text-slate-300" />
              <h3 className="mt-3 text-sm font-semibold text-slate-700">No tienes clases programadas para hoy</h3>
            </div>
          ) : null}
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">Mis asignaciones</h2>
            <p className="mt-1 text-xs text-slate-500">Cursos, grados y secciones de tu horario vigente.</p>
          </div>
          {!isPending && schedules.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{schedules.map(renderSchedule)}</div>
          )}
        </section>
      </main>

      {selectedSchedule && (
        <AttendanceDialog schedule={selectedSchedule} onClose={() => setSelectedSchedule(null)} />
      )}
    </div>
  )
}

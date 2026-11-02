import { useState } from 'react'
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
const weekDays = [1, 2, 3, 4, 5, 6, 7]

function currentWeekDates() {
  const today = new Date(`${limaToday()}T12:00:00Z`)
  const offsetFromMonday = (today.getUTCDay() + 6) % 7
  const monday = new Date(today)
  monday.setUTCDate(today.getUTCDate() - offsetFromMonday)

  return weekDays.map((day) => {
    const date = new Date(monday)
    date.setUTCDate(monday.getUTCDate() + day - 1)
    return {
      day,
      date: date.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat('es-PE', {
        day: 'numeric',
        month: 'short',
        timeZone: 'America/Lima',
      }).format(date),
    }
  })
}

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
  const initialStates = (data?.alumnos ?? []).reduce<Record<string, AttendanceState | null>>(
    (result, row) => {
      result[row.matriculaId] = row.estado === 'falta' ? 'evasion' : row.estado
      return result
    },
    {},
  )
  const states = stateOverrides[stateKey] ?? initialStates

  const presentCount = Object.values(states).filter((state) => state === 'presente').length
  const absentCount = Object.values(states).filter((state) => state === 'evasion').length
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
                  variant={states[row.matriculaId] === 'evasion' ? 'destructive' : 'outline'}
                  aria-pressed={states[row.matriculaId] === 'evasion'}
                  onClick={() => setStudentState(row.matriculaId, 'evasion')}
                  className={states[row.matriculaId] === 'evasion' ? '' : 'text-rose-700'}
                >
                  <X aria-hidden="true" />
                  Evasión
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
  const weekDates = currentWeekDates()
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-10">
        <a className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-emerald-950" href="/" aria-label="SIGA, inicio">
          <BrandMark />
          <span>SIGA</span>
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
              <h2 className="text-lg font-bold text-slate-900">Calendario semanal</h2>
              <p className="mt-1 text-xs text-slate-500">Consulta los cursos, horarios y secciones asignadas para cada día.</p>
            </div>
          </div>
          {isPending ? (
            <div className="flex gap-3 overflow-hidden">
              {weekDays.map((day) => <div key={day} className="h-64 min-w-56 flex-1 animate-pulse rounded-2xl bg-slate-200" />)}
            </div>
          ) : !error ? (
            <div className="overflow-x-auto pb-2">
              <div className="grid min-w-[980px] grid-cols-7 gap-3">
                {weekDates.map(({ day, date, label }) => {
                  const daySchedules = schedules.filter((schedule) => schedule.diaSemana === day)
                  const isToday = day === todayDay
                  return (
                    <section
                      key={day}
                      aria-label={`${weekdayLabel(day)} ${label}`}
                      className={`min-h-64 rounded-xl border p-3 ${isToday ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}
                    >
                      <header className="mb-3 border-b border-slate-100 pb-2">
                        <h3 className={`text-sm font-bold ${isToday ? 'text-emerald-800' : 'text-slate-800'}`}>
                          {weekdayLabel(day)}
                        </h3>
                        <p className="text-xs text-slate-500">
                          <time dateTime={date}>{label}</time>{isToday ? ' · Hoy' : ''}
                        </p>
                      </header>
                      <div className="space-y-2">
                        {daySchedules.length ? daySchedules.map((schedule) => (
                          <article key={schedule.id} className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
                            <p className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
                              <Clock3 className="size-3.5" aria-hidden="true" />
                              {timeLabel(schedule.horaInicio)}–{timeLabel(schedule.horaFin)}
                            </p>
                            <h4 className="mt-2 text-xs font-bold leading-snug text-slate-900">{schedule.curso.nombre}</h4>
                            <p className="mt-1 text-[11px] leading-snug text-slate-600">
                              {schedule.seccion.grado.nombre} · Sección {schedule.seccion.nombre}
                            </p>
                            <Button
                              className="mt-2 h-8 w-full px-2 text-xs"
                              variant="outline"
                              onClick={() => setSelectedSchedule(schedule)}
                            >
                              <Users aria-hidden="true" />
                              Pasar lista
                            </Button>
                          </article>
                        )) : (
                          <p className="py-6 text-center text-xs text-slate-400">Sin clases</p>
                        )}
                      </div>
                    </section>
                  )
                })}
              </div>
            </div>
          ) : null}
        </section>
      </main>

      {selectedSchedule && (
        <AttendanceDialog schedule={selectedSchedule} onClose={() => setSelectedSchedule(null)} />
      )}
    </div>
  )
}

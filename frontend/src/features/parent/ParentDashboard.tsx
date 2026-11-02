import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Download, FileCheck2, LogOut, Send, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import type { Usuario } from '../auth/types'
import { BrandMark } from '../auth/BrandMark'
import {
  createFamilyRequest, exportFamilyAttendance, getFamilyAttendance, getFamilyRequests, getFamilyStudents,
  limaToday, type FamilyAttendance, type FamilyStudent, type RequestType,
} from '../attendance/justificationRequestsService'
import { downloadCsv } from '../../lib/csv'

const today = limaToday()
const thirtyDaysAgo = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' })
  .format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
const familyStudentsKey = ['family-portal', 'students'] as const
const familyRequestsKey = ['family-portal', 'requests'] as const

function attendanceLabel(state: string) {
  const labels: Record<string, string> = {
    presente: 'Presente',
    tardanza: 'Tardanza',
    falta: 'Falta',
    falta_justificada: 'Falta justificada',
    tardanza_justificada: 'Tardanza justificada',
    evasion: 'Evasión de clase',
    retiro_temprano: 'Retiro temprano',
  }
  return labels[state] ?? state
}

function stateVariant(state: string) {
  if (state === 'falta' || state === 'evasion') return 'destructive' as const
  if (state.includes('justificada')) return 'default' as const
  return 'secondary' as const
}

export function ParentDashboard({
  usuario,
  onSignOut,
}: {
  usuario: Usuario
  onSignOut: () => Promise<void>
}) {
  const queryClient = useQueryClient()
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [desde, setDesde] = useState(thirtyDaysAgo)
  const [hasta, setHasta] = useState(today)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [fecha, setFecha] = useState(today)
  const [tipo, setTipo] = useState<RequestType>('falta_justificada')
  const [motivo, setMotivo] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const studentsQuery = useQuery({ queryKey: familyStudentsKey, queryFn: getFamilyStudents })
  const students = studentsQuery.data ?? []
  const studentId = selectedStudentId || students[0]?.id || ''
  const selectedStudent = students.find((student) => student.id === studentId)
  const attendanceQuery = useQuery({
    queryKey: ['family-portal', 'attendance', studentId, desde, hasta],
    queryFn: () => getFamilyAttendance(studentId, desde, hasta),
    enabled: Boolean(studentId) && Boolean(desde) && Boolean(hasta) && desde <= hasta,
  })
  const requestsQuery = useQuery({
    queryKey: familyRequestsKey,
    queryFn: getFamilyRequests,
    refetchInterval: 15000,
  })
  const attendance: FamilyAttendance[] = attendanceQuery.data ?? []
  const entryAttendances = attendance.filter((row) => row.tipo === 'ingreso')
  const classAttendances = attendance.filter((row) => row.tipo === 'clase')
  const requests = requestsQuery.data ?? []
  const activeEnrollment = selectedStudent?.matriculas.find((row) => row.estado === 'activa')
  const isLoading = studentsQuery.isPending
    || (Boolean(studentId) && attendanceQuery.isPending)
    || requestsQuery.isPending
  const error = studentsQuery.error ?? attendanceQuery.error ?? requestsQuery.error

  const requestDate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeEnrollment) {
      toast.error('El alumno no tiene una matrícula activa para recibir solicitudes.')
      return
    }
    const cleanReason = motivo.trim()
    if (cleanReason.length < 3) {
      toast.error('Escribe el motivo de la solicitud.')
      return
    }
    setIsSaving(true)
    void createFamilyRequest({
      matriculaId: activeEnrollment.id,
      fecha,
      tipo,
      motivo: cleanReason,
    }).then(async () => {
      await queryClient.invalidateQueries({ queryKey: familyRequestsKey })
      toast.success('Solicitud enviada al colegio.', {
        description: 'El auxiliar o director la revisará desde su panel.',
      })
      setIsFormOpen(false)
      setMotivo('')
    }).catch((saveError: unknown) => {
      toast.error(saveError instanceof Error ? saveError.message : 'No se pudo enviar la solicitud.')
    }).finally(() => setIsSaving(false))
  }

  const signOut = async () => {
    setIsSigningOut(true)
    try {
      await onSignOut()
    } finally {
      setIsSigningOut(false)
    }
  }

  const downloadAttendanceReport = async () => {
    if (!selectedStudent || attendanceQuery.isPending || attendanceQuery.isError) return
    setIsDownloading(true)
    try {
      const report = await exportFamilyAttendance(studentId, desde, hasta)
      if (report.truncado) {
        toast.warning('El reporte supera 10 000 registros. Reduce el periodo para descargarlo completo.')
        return
      }
      downloadCsv(
        `siga-asistencia-${selectedStudent.codigo}-${desde}-${hasta}.csv`,
        ['Fecha', 'Tipo de asistencia', 'Curso', 'Sección', 'Estado', 'Hora', 'Observación'],
        report.data.map((row) => [
          row.fecha,
          row.tipo === 'clase' ? 'Asistencia por clase' : 'Ingreso al colegio',
          row.curso ?? '',
          row.seccion,
          attendanceLabel(row.estado),
          row.hora ?? '',
          row.observacion ?? '',
        ]),
      )
      toast.success(`Reporte descargado con ${report.total} registros.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo descargar el reporte.')
    } finally {
      setIsDownloading(false)
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
          <span className="hidden text-right sm:block">
            <strong className="block text-xs text-slate-800">{usuario.nombres} {usuario.apellidos}</strong>
            <small className="text-slate-500">Portal familiar</small>
          </span>
          <Button variant="outline" size="sm" onClick={() => void signOut()} disabled={isSigningOut}>
            <LogOut aria-hidden="true" />
            <span className="hidden sm:inline">{isSigningOut ? 'Saliendo…' : 'Cerrar sesión'}</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
        <section className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Portal de familias</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Asistencias y justificaciones</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">Consulta los registros de tus hijos y envía una solicitud al colegio para su revisión.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void downloadAttendanceReport()}
              disabled={!selectedStudent || attendanceQuery.isPending || attendanceQuery.isError || isDownloading}
            >
              {isDownloading ? <span className="size-4 animate-spin rounded-full border-2 border-teal-700/30 border-t-teal-700" /> : <Download aria-hidden="true" />}
              {isDownloading ? 'Preparando…' : 'Descargar reporte'}
            </Button>
            <Button onClick={() => setIsFormOpen(true)} disabled={!activeEnrollment}>
              <Send aria-hidden="true" />
              Solicitar justificación
            </Button>
          </div>
        </section>

        {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error.message}</div>}

        <section className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <UserRound className="size-4 text-emerald-700" />
              Alumno
            </div>
            <select
              aria-label="Selecciona a tu hijo"
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              value={studentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
              disabled={studentsQuery.isPending || students.length === 0}
            >
              {students.length === 0 && <option value="">{studentsQuery.isPending ? 'Cargando alumnos…' : 'No hay alumnos vinculados'}</option>}
              {students.map((student: FamilyStudent) => (
                <option key={student.id} value={student.id}>{student.nombres} {student.apellidos} · {student.codigo}</option>
              ))}
            </select>
            {selectedStudent && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedStudent.matriculas.slice(0, 3).map((matricula) => (
                  <Badge key={matricula.id} variant="secondary">{matricula.anioAcademicoId} · {matricula.seccion}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><CalendarDays className="size-4" /> Periodo a consultar</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-600">Desde<input type="date" max={today} value={desde} onChange={(event) => setDesde(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-emerald-200 bg-white px-2 text-sm" /></label>
              <label className="text-xs text-slate-600">Hasta<input type="date" max={today} value={hasta} onChange={(event) => setHasta(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-emerald-200 bg-white px-2 text-sm" /></label>
            </div>
          </div>
        </section>

        <section className="mb-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <FileCheck2 className="size-4 text-emerald-700" />
            <h2 className="font-bold text-slate-900">Ingreso al colegio</h2>
          </header>
          <div className="overflow-x-auto">
            <Table className="min-w-[880px] text-left">
              <TableHeader><TableRow className="bg-slate-50"><TableHead>FECHA</TableHead><TableHead>SECCIÓN</TableHead><TableHead>ESTADO</TableHead><TableHead>HORA</TableHead><TableHead>OBSERVACIÓN</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? <TableRow><TableCell colSpan={5} className="py-12 text-center text-slate-500">Cargando registros de ingreso…</TableCell></TableRow>
                  : entryAttendances.map((row) => <TableRow key={row.id}><TableCell>{row.fecha}</TableCell><TableCell>{row.seccion}</TableCell><TableCell><Badge variant={stateVariant(row.estado)}>{attendanceLabel(row.estado)}</Badge></TableCell><TableCell>{row.hora ?? '—'}</TableCell><TableCell className="max-w-xs whitespace-normal">{row.observacion ?? '—'}</TableCell></TableRow>)}
                {!isLoading && entryAttendances.length === 0 && <TableRow><TableCell colSpan={5} className="py-12 text-center text-slate-500">No hay ingresos al colegio registrados en este periodo.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="mb-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <FileCheck2 className="size-4 text-indigo-700" />
            <h2 className="font-bold text-slate-900">Asistencia por clase</h2>
          </header>
          <div className="overflow-x-auto">
            <Table className="min-w-[880px] text-left">
              <TableHeader><TableRow className="bg-slate-50"><TableHead>FECHA</TableHead><TableHead>CURSO</TableHead><TableHead>SECCIÓN</TableHead><TableHead>ESTADO</TableHead><TableHead>HORA</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? <TableRow><TableCell colSpan={5} className="py-12 text-center text-slate-500">Cargando registros de clase…</TableCell></TableRow>
                  : classAttendances.map((row) => <TableRow key={row.id}><TableCell>{row.fecha}</TableCell><TableCell>{row.curso ?? '—'}</TableCell><TableCell>{row.seccion}</TableCell><TableCell><Badge variant={stateVariant(row.estado)}>{attendanceLabel(row.estado)}</Badge></TableCell><TableCell>{row.hora ?? '—'}</TableCell></TableRow>)}
                {!isLoading && classAttendances.length === 0 && <TableRow><TableCell colSpan={5} className="py-12 text-center text-slate-500">No hay asistencias por clase registradas en este periodo.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Mis solicitudes</h2></header>
          <div className="divide-y divide-slate-100">
            {requestsQuery.isPending ? <p className="p-5 text-sm text-slate-500">Cargando solicitudes…</p>
              : requests.length ? requests.map((item) => (
                <article key={item.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div><p className="text-sm font-semibold text-slate-800">{item.fecha} · {item.alumno.nombres} {item.alumno.apellidos}</p><p className="mt-1 text-sm text-slate-600">{item.motivo}</p>{item.observacionRevision && <p className="mt-1 text-xs text-slate-500">Respuesta del colegio: {item.observacionRevision}</p>}</div>
                  <Badge variant={item.estado === 'rechazada' ? 'destructive' : item.estado === 'aprobada' ? 'default' : 'secondary'}>{item.estado}</Badge>
                </article>
              )) : <p className="p-5 text-sm text-slate-500">Aún no has enviado solicitudes.</p>}
          </div>
        </section>
      </main>

      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!isSaving) setIsFormOpen(open) }}>
        <DialogContent className="max-w-lg p-6">
          <form onSubmit={requestDate}>
            <DialogTitle>Solicitar justificación</DialogTitle>
            <DialogDescription className="mt-2">La solicitud quedará pendiente hasta que el auxiliar o director la revise.</DialogDescription>
            {selectedStudent && <p className="mt-4 text-sm font-semibold">{selectedStudent.nombres} {selectedStudent.apellidos}</p>}
            <label className="mt-4 block text-sm font-medium text-slate-700">Fecha
              <input type="date" value={fecha} max={today} required onChange={(event) => setFecha(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3" />
            </label>
            <label className="mt-4 block text-sm font-medium text-slate-700">Tipo
              <select value={tipo} onChange={(event) => setTipo(event.target.value as RequestType)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3">
                <option value="falta_justificada">Falta</option>
                <option value="tardanza_justificada">Tardanza</option>
              </select>
            </label>
            <label className="mt-4 block text-sm font-medium text-slate-700">Motivo
              <textarea required minLength={3} maxLength={500} value={motivo} onChange={(event) => setMotivo(event.target.value)} className="mt-1 min-h-28 w-full rounded-lg border border-slate-200 p-3" placeholder="Indica brevemente el motivo comunicado al colegio." />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancelar</Button></DialogClose>
              <Button type="submit" disabled={isSaving || motivo.trim().length < 3}>{isSaving ? 'Enviando…' : 'Enviar solicitud'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

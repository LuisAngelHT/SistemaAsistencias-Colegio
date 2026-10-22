import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createEnrollment,
  listEnrollments,
  loadManagementOptions,
  searchStudents,
  updateEnrollmentStatus,
} from './managementService'
import type { ApiRecord, ManagementOptions } from './types'
import { enrollmentListKey, managementOptionsKey, studentSearchKey } from '../queryKeys'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../../components/ui/alert-dialog'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table'

const emptyOptions: ManagementOptions = {
  years: [],
  grades: [],
  teachers: [],
  sections: [],
  courses: [],
}

const enrollmentStatus: Record<string, string> = {
  activa: 'Activa',
  retirada: 'Retirada',
  trasladada: 'Trasladada',
  finalizada: 'Finalizada',
}

function text(record: ApiRecord | null, key: string): string {
  const value = record?.[key]
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : ''
}

function relation(record: ApiRecord, key: string): ApiRecord | null {
  const value = record[key]
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as ApiRecord
    : null
}

function studentName(student: ApiRecord): string {
  return `${text(student, 'nombres')} ${text(student, 'apellidos')}`.trim()
}

function sectionName(section: ApiRecord): string {
  const grade = relation(section, 'grado')
  return `${text(grade, 'nombre')} · ${text(section, 'nombre')}`
}

export function EnrollmentsPanel({ onBack }: { onBack: () => void }) {
  const queryClient = useQueryClient()
  const [selectedSection, setSelectedSection] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [addingStudentId, setAddingStudentId] = useState('')
  const [changingEnrollmentId, setChangingEnrollmentId] = useState('')
  const [mutationError, setMutationError] = useState('')
  const [pendingStatus, setPendingStatus] = useState<{ enrollment: ApiRecord; status: string } | null>(null)
  const optionsQuery = useQuery({
    queryKey: managementOptionsKey('matriculas'),
    queryFn: () => loadManagementOptions('matriculas'),
  })
  const options: ManagementOptions = optionsQuery.data ?? emptyOptions
  const defaultSection = options.sections.find((section) => {
    const year = relation(section, 'anioAcademico')
    return year?.activo === true
  }) ?? options.sections[0]
  const selectedSectionId =
    selectedSection || (typeof defaultSection?.id === 'number' ? String(defaultSection.id) : '')
  const enrollmentQuery = useQuery({
    queryKey: enrollmentListKey(Number(selectedSectionId)),
    queryFn: () => listEnrollments(Number(selectedSectionId)),
    enabled: Boolean(selectedSectionId),
  })
  const searchQuery = useQuery({
    queryKey: studentSearchKey(debouncedSearch),
    queryFn: () => searchStudents(debouncedSearch, 1),
    enabled: debouncedSearch.length >= 2,
  })
  const students = (searchQuery.data?.data ?? []).filter((student) => student.activo === true)
  const studentTotal = searchQuery.data?.total ?? 0
  const enrollments = enrollmentQuery.data ?? []
  const isLoading = enrollmentQuery.isPending
  const isOptionsLoading = optionsQuery.isPending
  const isSearching = searchQuery.isFetching && debouncedSearch.length >= 2
  const error = mutationError || enrollmentQuery.error?.message || optionsQuery.error?.message || ''
  const searchError = searchQuery.error?.message ?? ''

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const enrollStudent = async (student: ApiRecord) => {
    if (!selectedSectionId || typeof student.id !== 'string') return
    setAddingStudentId(student.id)
    setMutationError('')
    try {
      await createEnrollment(student.id, Number(selectedSectionId))
      await queryClient.invalidateQueries({ queryKey: enrollmentListKey(Number(selectedSectionId)) })
      await queryClient.invalidateQueries({ queryKey: ['director', 'students', 'search'] })
      setSearch('')
      setDebouncedSearch('')
      toast.success('Alumno matriculado correctamente.')
    } catch (enrollmentError) {
      const message = enrollmentError instanceof Error
        ? enrollmentError.message
        : 'No se pudo matricular al alumno.'
      setMutationError(
        message,
      )
      toast.error(message)
    } finally {
      setAddingStudentId('')
    }
  }

  const setStatus = (enrollment: ApiRecord, status: string) => {
    setPendingStatus({ enrollment, status })
  }

  const confirmStatusChange = async () => {
    if (!pendingStatus) return
    const enrollmentId = pendingStatus.enrollment.id
    if (typeof enrollmentId !== 'string') return
    const { status } = pendingStatus
    setPendingStatus(null)
    setChangingEnrollmentId(enrollmentId)
    setMutationError('')
    try {
      await updateEnrollmentStatus(enrollmentId, status)
      await queryClient.invalidateQueries({ queryKey: enrollmentListKey(Number(selectedSectionId)) })
      toast.success(status === 'retirada' ? 'Matrícula retirada.' : 'Estado de matrícula actualizado.')
    } catch (updateError) {
      const message = updateError instanceof Error
        ? updateError.message
        : 'No se pudo actualizar el estado de la matrícula.'
      setMutationError(
        message,
      )
      toast.error(message)
    } finally {
      setChangingEnrollmentId('')
    }
  }

  const selectedSectionRecord = options.sections.find(
    (section) => String(section.id) === selectedSectionId,
  )

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <button
        type="button"
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-emerald-800"
      >
        <span aria-hidden="true">←</span>
        Volver al resumen
      </button>

      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
          Gestión académica
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Matrículas</h1>
        <p className="mt-2 text-sm text-slate-500">
          Asigna alumnos registrados a una sección del año académico correspondiente.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.85fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 className="font-semibold text-slate-800">Alumnos de la sección</h2>
              <p className="mt-1 text-xs text-slate-500">
                {selectedSectionRecord
                  ? sectionName(selectedSectionRecord)
                  : 'Selecciona una sección'}
              </p>
            </div>
            <label className="block sm:w-64">
              <span className="sr-only">Sección</span>
              <select
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                value={selectedSectionId}
                disabled={isOptionsLoading}
                onChange={(event) => {
                  setMutationError('')
                  setSelectedSection(event.target.value)
                }}
              >
                <option value="">
                  {isOptionsLoading ? 'Cargando secciones…' : 'Selecciona una sección'}
                </option>
                {options.sections.map((section) => (
                  <option key={String(section.id)} value={String(section.id)}>
                    {sectionName(section)}
                  </option>
                ))}
              </select>
            </label>
          </header>

          {error && (
            <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <Table className="min-w-[560px] text-left">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>ALUMNO</TableHead>
                  <TableHead>CÓDIGO</TableHead>
                  <TableHead>ESTADO</TableHead>
                  <TableHead className="text-right">ACCIÓN</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell className="py-14 text-center text-sm text-slate-500" colSpan={4}>
                    <span className="mx-auto mb-3 block h-6 w-6 animate-spin rounded-full border-2 border-emerald-700/20 border-t-emerald-700" />
                    Cargando matrículas…
                  </TableCell></TableRow>
                ) : enrollments.map((enrollment) => {
                  const student = relation(enrollment, 'alumno')
                  const status = text(enrollment, 'estado')
                  return (
                    <TableRow key={String(enrollment.id)}>
                      <TableCell>
                        <strong className="block text-sm font-medium text-slate-800">{student ? studentName(student) : 'Alumno'}</strong>
                        <span className="mt-1 block text-xs text-slate-500">{text(student, 'dni') || 'Sin DNI'}</span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{text(student, 'codigo') || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={status === 'activa' ? 'default' : 'secondary'}>
                          {enrollmentStatus[status] ?? status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={changingEnrollmentId === enrollment.id}
                          onClick={() => void setStatus(enrollment, 'retirada')}
                          className="text-rose-700 hover:bg-rose-50"
                          title="Retirar matrícula"
                          aria-label="Retirar matrícula"
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!isLoading && enrollments.length === 0 && (
                  <TableRow><TableCell className="py-14 text-center" colSpan={4}>
                    <strong className="block text-sm font-semibold text-slate-700">Aún no hay alumnos matriculados</strong>
                    <span className="mt-1 block text-xs text-slate-500">Busca un alumno y asígnalo a esta sección.</span>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <path d="m3 8 9-4 9 4-9 4-9-4Z" /><path d="M6 10v5c3.5 3 8.5 3 12 0v-5" />
              </svg>
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Agregar alumno</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Busca por nombre, apellido, DNI o código.</p>
            </div>
          </div>

          <label className="block">
            <span className="sr-only">Buscar alumno</span>
            <Input
              className="h-11 bg-slate-50 focus:bg-white"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
              }}
              placeholder="Escribe al menos 2 caracteres"
              disabled={!selectedSectionId}
            />
          </label>

          {searchError && (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
              {searchError}
            </p>
          )}

          <div className="mt-3 max-h-[390px] overflow-y-auto">
            {isSearching && <p className="py-5 text-center text-xs text-slate-500">Buscando alumnos…</p>}
            {!isSearching && debouncedSearch.length >= 2 && students.length === 0 && !searchError && (
              <p className="py-5 text-center text-xs text-slate-500">No encontramos alumnos activos.</p>
            )}
            {!isSearching && students.map((student) => (
              <div className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0" key={String(student.id)}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold uppercase text-slate-600">
                  {text(student, 'nombres').charAt(0)}{text(student, 'apellidos').charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-xs font-semibold text-slate-800">{studentName(student)}</strong>
                  <small className="mt-1 block truncate text-[10px] text-slate-500">
                    {text(student, 'codigo')}{text(student, 'dni') ? ` · DNI ${text(student, 'dni')}` : ''}
                  </small>
                </span>
                <Button
                  type="button"
                  size="sm"
                  disabled={!selectedSectionId || addingStudentId === student.id}
                  onClick={() => void enrollStudent(student)}
                >
                  <Plus aria-hidden="true" />
                  Agregar
                </Button>
              </div>
            ))}
          </div>
          {!isSearching && debouncedSearch.length >= 2 && students.length > 0 && studentTotal > students.length && (
            <p className="mt-2 text-[10px] text-slate-500">            Hay más coincidencias. Refina la búsqueda para encontrar otro alumno.</p>
          )}
          {!selectedSectionId && !isOptionsLoading && (
            <p className="mt-3 text-xs text-amber-700">Primero selecciona una sección para matricular.</p>
          )}
        </aside>
      </div>
      <AlertDialog
        open={pendingStatus !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStatus(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus?.status === 'retirada' ? 'Retirar matrícula' : 'Actualizar matrícula'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus?.status === 'retirada'
                ? 'El alumno dejará de pertenecer a esta sección. ¿Deseas continuar?'
                : `¿Deseas cambiar el estado de la matrícula a "${enrollmentStatus[pendingStatus?.status ?? ''] ?? ''}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmStatusChange()}>
              {pendingStatus?.status === 'retirada' ? 'Retirar' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

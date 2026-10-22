import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  buildPayload,
  createRecord,
  deleteRecord,
  listRecords,
  loadManagementOptions,
  pageSize,
  setRecordActive,
  updateRecord,
} from './managementService'
import type {
  ApiRecord,
  FieldDefinition,
  FormValues,
  ManagementModule,
  ManagementOptions,
  SelectOption,
} from './types'
import { managementListKey, managementOptionsKey } from '../queryKeys'
import { Copy, Pencil, Plus, QrCode, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { QRCodeSVG } from 'qrcode.react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../components/ui/alert-dialog'

const moduleTitles: Record<ManagementModule, string> = {
  profesores: 'Profesores',
  auxiliares: 'Auxiliares',
  alumnos: 'Alumnos',
  secciones: 'Secciones',
  grados: 'Grados',
  horarios: 'Horarios',
  cursos: 'Cursos',
  'anios-academicos': 'Años académicos',
  matriculas: 'Matrículas',
}

const levelNames: Record<string, string> = {
  inicial: 'Inicial',
  primaria: 'Primaria',
  secundaria: 'Secundaria',
}

const weekdays: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
}

type TableColumn = {
  label: string
  render: (record: ApiRecord) => ReactNode
}

function stringValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : ''
}

function getText(record: ApiRecord, key: string): string {
  return stringValue(record[key])
}

function getRelation(record: ApiRecord, key: string): ApiRecord | null {
  const value = record[key]
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as ApiRecord
    : null
}

function personName(record: ApiRecord | null): string {
  if (!record) return 'Sin asignar'
  return [getText(record, 'nombres'), getText(record, 'apellidos')]
    .filter(Boolean)
    .join(' ') || '—'
}

function columnsFor(module: ManagementModule): TableColumn[] {
  if (module === 'profesores' || module === 'auxiliares') {
    return [
      { label: 'PERSONAL', render: (row) => personName(row) },
      { label: 'CORREO', render: (row) => getText(row, 'email') || '—' },
      { label: 'DNI', render: (row) => getText(row, 'dni') || '—' },
      { label: 'TELÉFONO', render: (row) => getText(row, 'telefono') || '—' },
    ]
  }

  if (module === 'alumnos') {
    return [
      { label: 'CÓDIGO', render: (row) => getText(row, 'codigo') || '—' },
      { label: 'ALUMNO', render: (row) => personName(row) },
      { label: 'DNI', render: (row) => getText(row, 'dni') || '—' },
      { label: 'FECHA DE NACIMIENTO', render: (row) => getText(row, 'fechaNacimiento') || '—' },
    ]
  }
  if (module === 'secciones') {
    return [
      {
        label: 'SECCIÓN',
        render: (row) => `${getText(getRelation(row, 'grado') ?? {}, 'nombre')} · ${getText(row, 'nombre')}`,
      },
      {
        label: 'NIVEL',
        render: (row) => levelNames[getText(getRelation(row, 'grado') ?? {}, 'nivel')] ?? '—',
      },
      { label: 'TUTOR', render: (row) => personName(getRelation(row, 'tutor')) },
      { label: 'INGRESO', render: (row) => getText(row, 'horaIngreso').slice(0, 5) || '—' },
    ]
  }

  if (module === 'grados') {
    return [
      { label: 'NIVEL EDUCATIVO', render: (row) => levelNames[getText(row, 'nivel')] ?? '—' },
      { label: 'GRADO', render: (row) => getText(row, 'nombre') },
      { label: 'ORDEN', render: (row) => getText(row, 'orden') },
    ]
  }

  if (module === 'cursos') {
    return [
      { label: 'CÓDIGO', render: (row) => getText(row, 'codigo') || '—' },
      { label: 'CURSO', render: (row) => getText(row, 'nombre') },
    ]
  }

  if (module === 'anios-academicos') {
    return [
      { label: 'AÑO', render: (row) => getText(row, 'nombre') },
      { label: 'FECHA DE INICIO', render: (row) => getText(row, 'fechaInicio') },
      { label: 'FECHA DE FIN', render: (row) => getText(row, 'fechaFin') },
    ]
  }
  return [
    { label: 'CURSO', render: (row) => getText(getRelation(row, 'curso') ?? {}, 'nombre') || '—' },
    {
      label: 'SECCIÓN',
      render: (row) => {
        const section = getRelation(row, 'seccion')
        const grade = getRelation(section ?? {}, 'grado')
        return section
          ? `${getText(grade ?? {}, 'nombre')} · ${getText(section, 'nombre')}`
          : '—'
      },
    },
    { label: 'PROFESOR', render: (row) => personName(getRelation(row, 'profesor')) },
    {
      label: 'DÍA Y HORARIO',
      render: (row) =>
        `${weekdays[Number(row.diaSemana)] ?? '—'} · ${getText(row, 'horaInicio').slice(0, 5)}–${getText(row, 'horaFin').slice(0, 5)}`,
    },
  ]
}

function optionsFromRecords(
  records: ApiRecord[],
  label: (record: ApiRecord) => string,
): SelectOption[] {
  return records.flatMap((record) => {
    const id = record.id
    if (typeof id !== 'string' && typeof id !== 'number') return []
    return [{ value: String(id), label: label(record) }]
  })
}

function fieldsFor(
  module: ManagementModule,
  options: ManagementOptions,
  isEditing: boolean,
): FieldDefinition[] {
  if (module === 'profesores' || module === 'auxiliares') {
    return [
      { name: 'nombres', label: 'Nombres', type: 'text', required: true, maxLength: 100 },
      { name: 'apellidos', label: 'Apellidos', type: 'text', required: true, maxLength: 100 },
      ...(!isEditing
        ? [{ name: 'email', label: 'Correo electrónico', type: 'email' as const, required: true }]
        : []),
      ...(!isEditing
        ? [{
            name: 'password',
            label: 'Contraseña inicial',
            type: 'password' as const,
            required: true,
            help: 'Debe contener al menos 6 caracteres.',
          }]
        : []),
      { name: 'dni', label: 'DNI', type: 'text', min: 8, max: 15, placeholder: 'Opcional' },
      { name: 'telefono', label: 'Teléfono', type: 'text', min: 6, max: 20, placeholder: 'Opcional' },
    ]
  }

  if (module === 'alumnos') {
    return [
      { name: 'nombres', label: 'Nombres', type: 'text', required: true, maxLength: 100 },
      { name: 'apellidos', label: 'Apellidos', type: 'text', required: true, maxLength: 100 },
      { name: 'codigo', label: 'Código del alumno', type: 'text', pattern: '[A-Za-z0-9-]{3,20}', placeholder: 'Se genera automáticamente si queda vacío' },
      { name: 'dni', label: 'DNI', type: 'text', min: 8, max: 15, placeholder: 'Opcional' },
      { name: 'fechaNacimiento', label: 'Fecha de nacimiento', type: 'date' },
      ...(isEditing
        ? [{
            name: 'activo',
            label: 'Estado',
            type: 'select' as const,
            options: [
              { value: 'true', label: 'Activo' },
              { value: 'false', label: 'Inactivo' },
            ],
          }]
        : []),
    ]
  }

  if (module === 'secciones') {
    return [
      ...(!isEditing
        ? [{
            name: 'anioAcademicoId',
            label: 'Año académico',
            type: 'select' as const,
            required: true,
            options: optionsFromRecords(options.years, (record) =>
              `${getText(record, 'nombre')}${record.activo === true ? ' · Activo' : ''}`,
            ),
          }]
        : []),
      {
        name: 'gradoId',
        label: 'Grado',
        type: 'select',
        required: true,
        options: optionsFromRecords(options.grades, (record) =>
          `${levelNames[getText(record, 'nivel')] ?? ''} ${getText(record, 'nombre')}`.trim(),
        ),
      },
      { name: 'nombre', label: 'Nombre de sección', type: 'text', required: true, maxLength: 10, placeholder: 'Ej. A' },
      {
        name: 'tutorId',
        label: 'Tutor',
        type: 'select',
        options: optionsFromRecords(options.teachers, personName),
        help: 'Opcional. Solo se muestran profesores activos.',
      },
      { name: 'horaIngreso', label: 'Hora de ingreso', type: 'time', required: true },
      { name: 'toleranciaMin', label: 'Tolerancia (minutos)', type: 'number', required: true, min: 0 },
    ]
  }

  if (module === 'grados') {
    return [
      {
        name: 'nivel',
        label: 'Nivel educativo',
        type: 'select',
        required: true,
        options: [
          { value: 'inicial', label: 'Inicial' },
          { value: 'primaria', label: 'Primaria' },
          { value: 'secundaria', label: 'Secundaria' },
        ],
      },
      { name: 'nombre', label: 'Nombre del grado', type: 'text', required: true, maxLength: 50, placeholder: 'Ej. 1° grado' },
      { name: 'orden', label: 'Orden dentro del nivel', type: 'number', required: true, min: 1 },
    ]
  }

  if (module === 'cursos') {
    return [
      { name: 'nombre', label: 'Nombre del curso', type: 'text', required: true, maxLength: 100 },
      { name: 'codigo', label: 'Código', type: 'text', maxLength: 20, placeholder: 'Opcional' },
    ]
  }

  if (module === 'anios-academicos') {
    return [
      { name: 'nombre', label: 'Nombre del año académico', type: 'text', required: true, maxLength: 20, placeholder: 'Ej. 2026' },
      { name: 'fechaInicio', label: 'Fecha de inicio', type: 'date', required: true },
      { name: 'fechaFin', label: 'Fecha de fin', type: 'date', required: true },
    ]
  }
  if (module === 'matriculas') return []

  return [
    ...(!isEditing
      ? [{
          name: 'seccionId',
          label: 'Sección',
          type: 'select' as const,
          required: true,
          options: optionsFromRecords(options.sections, (record) => {
            const grade = getRelation(record, 'grado')
            return `${getText(grade ?? {}, 'nombre')} · ${getText(record, 'nombre')}`
          }),
        }]
      : []),
    {
      name: 'cursoId',
      label: 'Curso',
      type: 'select',
      required: true,
      options: optionsFromRecords(options.courses, (record) => getText(record, 'nombre')),
    },
    {
      name: 'profesorId',
      label: 'Profesor',
      type: 'select',
      required: true,
      options: optionsFromRecords(options.teachers, personName),
    },
    {
      name: 'diaSemana',
      label: 'Día de la semana',
      type: 'select',
      required: true,
      options: Object.entries(weekdays)
        .filter(([day]) => Number(day) <= 5)
        .map(([value, label]) => ({ value, label })),
    },
    { name: 'horaInicio', label: 'Hora de inicio', type: 'time', required: true },
    { name: 'horaFin', label: 'Hora de fin', type: 'time', required: true },
  ]
}

function relationId(record: ApiRecord, key: string): string {
  const directId = record[`${key}Id`]
  if (typeof directId === 'string' || typeof directId === 'number') return String(directId)
  const relation = getRelation(record, key)
  return relation ? stringValue(relation.id) : ''
}

function initialValues(
  module: ManagementModule,
  record: ApiRecord | null,
  fields: FieldDefinition[],
): FormValues {
  if (!record) {
    const defaults: FormValues = {}
    if (module === 'secciones') {
      const activeYear = fields.find((field) => field.name === 'anioAcademicoId')
        ?.options?.find((option) => option.label.includes('· Activo'))
      if (activeYear) defaults.anioAcademicoId = activeYear.value
      defaults.horaIngreso = '08:00'
      defaults.toleranciaMin = '10'
    }
    if (module === 'horarios') defaults.diaSemana = '1'
    if (module === 'alumnos') defaults.activo = 'true'
    return defaults
  }

  const values: FormValues = {}
  for (const field of fields) {
    if (field.name === 'activo') {
      values.activo = record.activo === true ? 'true' : 'false'
    } else if (['gradoId', 'tutorId', 'cursoId', 'profesorId', 'seccionId'].includes(field.name)) {
      values[field.name] = relationId(record, field.name.replace('Id', ''))
    } else {
      const raw = record[field.name]
      const value = stringValue(raw)
      values[field.name] = ['horaIngreso', 'horaInicio', 'horaFin'].includes(field.name)
        ? value.slice(0, 5)
        : value
    }
  }
  return values
}

function RecordForm({
  module,
  record,
  options,
  isSaving,
  error,
  onClose,
  onSave,
}: {
  module: ManagementModule
  record: ApiRecord | null
  options: ManagementOptions
  isSaving: boolean
  error: string
  onClose: () => void
  onSave: (values: Record<string, string>) => Promise<void>
}) {
  const isEditing = record !== null
  const fields = fieldsFor(module, options, isEditing)
  const [values, setValues] = useState<FormValues>(() =>
    initialValues(module, record, fields),
  )

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formValues = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, String(value)]),
    )
    void onSave(formValues)
  }

  const inputClass =
    'mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose()
      }}
    >
      <section
        className="my-auto w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-form-title"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">
              Gestión escolar
            </p>
            <h2 id="record-form-title" className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              {isEditing ? 'Editar' : 'Registrar'} {moduleTitles[module].toLocaleLowerCase()}
            </h2>
          </div>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Cerrar formulario"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="grid max-h-[65vh] grid-cols-1 gap-x-5 gap-y-4 overflow-y-auto px-6 py-6 sm:grid-cols-2 sm:px-7">
            {fields.map((field) => (
              <label
                className={field.name === 'password' ? 'sm:col-span-2' : ''}
                key={field.name}
              >
                <span className="text-sm font-medium text-slate-700">
                  {field.label}
                  {field.required && <span className="ml-1 text-rose-600">*</span>}
                </span>
                {field.type === 'select' ? (
                  <select
                    className={inputClass}
                    value={String(values[field.name] ?? '')}
                    required={field.required}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.name]: event.target.value,
                      }))
                    }
                  >
                    <option value="">
                      {field.options?.length ? 'Selecciona una opción' : 'No hay opciones disponibles'}
                    </option>
                    {field.options?.map((option) => (
                      <option value={option.value} key={option.value}>{option.label}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    className={inputClass}
                    type={field.type}
                    value={String(values[field.name] ?? '')}
                    required={field.required}
                    min={field.min}
                    max={field.max}
                    maxLength={field.maxLength}
                    pattern={field.pattern}
                    placeholder={field.placeholder}
                    minLength={field.name === 'password' ? 6 : field.min}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.name]: event.target.value,
                      }))
                    }
                  />
                )}
                {field.help && (
                  <span className="mt-1 block text-xs text-slate-500">{field.help}</span>
                )}
              </label>
            ))}
          </div>

          {error && (
            <div className="mx-6 mb-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:mx-7" role="alert">
              {error}
            </div>
          )}

          <footer className="flex flex-col-reverse justify-end gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row sm:px-7">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
            >
              {isSaving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {isSaving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear registro'}
            </Button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function statusLabel(record: ApiRecord): { label: string; active: boolean } | null {
  if (typeof record.activo !== 'boolean') return null
  return { label: record.activo ? 'Activo' : 'Inactivo', active: record.activo }
}

export function DirectorManagement({
  module,
  onBack,
}: {
  module: ManagementModule
  onBack: () => void
}) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<ApiRecord | null>(null)
  const [formError, setFormError] = useState('')
  const [actionError, setActionError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [workingId, setWorkingId] = useState<string | number | null>(null)
  const [pendingAction, setPendingAction] = useState<ApiRecord | null>(null)
  const [qrStudent, setQrStudent] = useState<ApiRecord | null>(null)
  const optionsQuery = useQuery({
    queryKey: managementOptionsKey(module),
    queryFn: () => loadManagementOptions(module),
  })
  const listQuery = useQuery({
    queryKey: managementListKey(module, page, debouncedQuery),
    queryFn: () => listRecords(module, page, debouncedQuery),
  })
  const records = listQuery.data?.data ?? []
  const total = listQuery.data?.total ?? 0
  const options: ManagementOptions = optionsQuery.data ?? {
    years: [],
    grades: [],
    teachers: [],
    sections: [],
    courses: [],
  }
  const isLoading = listQuery.isPending
  const error = actionError || listQuery.error?.message || ''
  const optionsError = optionsQuery.error?.message ?? ''
  const isOptionsLoading = optionsQuery.isPending

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => window.clearTimeout(timeout)
  }, [query])

  const columns = useMemo(() => columnsFor(module), [module])
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const refresh = () => {
    setActionError('')
    void queryClient.invalidateQueries({ queryKey: ['director', 'management', module] })
  }

  const openCreate = () => {
    setEditingRecord(null)
    setFormError('')
    setIsFormOpen(true)
  }

  const openEdit = (record: ApiRecord) => {
    setEditingRecord(record)
    setFormError('')
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (isSaving) return
    setIsFormOpen(false)
    setEditingRecord(null)
    setFormError('')
  }

  const saveRecord = async (values: Record<string, string>) => {
    setIsSaving(true)
    setFormError('')
    try {
      const payload = buildPayload(module, values, editingRecord !== null)
      if (editingRecord) {
        const id = editingRecord.id
        if (typeof id !== 'string' && typeof id !== 'number') {
          throw new Error('No se encontró el identificador del registro.')
        }
        await updateRecord(module, id, payload)
        toast.success('Registro actualizado correctamente.')
      } else {
        await createRecord(module, payload)
        toast.success('Registro creado correctamente.')
      }
      setIsFormOpen(false)
      setEditingRecord(null)
      void queryClient.invalidateQueries({ queryKey: ['director'] })
    } catch (saveError) {
      const message = saveError instanceof Error
        ? saveError.message
        : 'No se pudo guardar el registro.'
      setFormError(
        message,
      )
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const confirmPendingAction = async () => {
    if (!pendingAction) return
    const record = pendingAction
    setPendingAction(null)
    const id = record.id
    if (typeof id !== 'string' && typeof id !== 'number') return

    setWorkingId(id)
    setActionError('')
    try {
      await deleteRecord(module, id)
      toast.success('Registro eliminado correctamente.')
      void queryClient.invalidateQueries({ queryKey: ['director'] })
    } catch (actionError) {
      const message = actionError instanceof Error
        ? actionError.message
        : 'No se pudo eliminar el registro.'
      setActionError(message)
      toast.error(message)
    } finally {
      setWorkingId(null)
    }
  }

  const handleDelete = (record: ApiRecord) => {
    const id = record.id
    if (typeof id !== 'string' && typeof id !== 'number') return
    setPendingAction(record)
  }

  const handleStatusChange = async (record: ApiRecord, active: boolean) => {
    const id = record.id
    if ((typeof id !== 'string' && typeof id !== 'number') || record.activo === active) return

    setWorkingId(id)
    setActionError('')
    try {
      await setRecordActive(module, id, active)
      toast.success(active ? 'Registro activado.' : 'Registro cambiado a inactivo.')
      void queryClient.invalidateQueries({ queryKey: ['director'] })
    } catch (statusError) {
      const message = statusError instanceof Error
        ? statusError.message
        : 'No se pudo cambiar el estado del registro.'
      setActionError(message)
      toast.error(message)
    } finally {
      setWorkingId(null)
    }
  }

  const copyStudentCode = async () => {
    if (!qrStudent) return
    try {
      await navigator.clipboard.writeText(getText(qrStudent, 'codigo'))
      toast.success('Código copiado.')
    } catch {
      toast.error('No se pudo copiar el código. Puedes seleccionarlo manualmente.')
    }
  }

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

      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            Gestión escolar
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {moduleTitles[module]}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Administra los registros de {moduleTitles[module].toLocaleLowerCase()} del colegio.
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreate}
          disabled={isOptionsLoading}
          className="h-11 rounded-lg px-4"
        >
          <Plus aria-hidden="true" />
          Nuevo registro
        </Button>
      </div>

      {optionsError && (
        <div className="mb-5 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <span>{optionsError}</span>
          <span className="text-xs">Algunos selectores podrían no estar disponibles.</span>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-semibold text-slate-800">Listado de {moduleTitles[module].toLocaleLowerCase()}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {isLoading ? 'Cargando registros…' : `${total.toLocaleString('es-PE')} registro${total === 1 ? '' : 's'}`}
            </p>
          </div>
          <div className="flex gap-2">
            <label className="relative block min-w-0 flex-1 sm:w-72">
              <span className="sr-only">Buscar</span>
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" strokeWidth="1.5" />
                <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <Input
                className="h-10 bg-slate-50 pl-9 pr-3 focus:bg-white"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
                placeholder={`Buscar ${moduleTitles[module].toLocaleLowerCase()}…`}
              />
            </label>
            <Button
              type="button"
              onClick={refresh}
              disabled={isLoading}
              variant="outline"
              size="icon"
              aria-label="Actualizar listado"
            >
              <RefreshCw className={listQuery.isFetching ? 'animate-spin' : ''} aria-hidden="true" />
            </Button>
          </div>
        </div>

        {error && (
          <div className="m-4 flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <span>{error}</span>
            <button className="font-semibold underline underline-offset-2" onClick={refresh}>Reintentar</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table className="min-w-[720px] border-collapse text-left">
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                {columns.map((column) => (
                  <TableHead className="py-3.5 tracking-[0.12em]" key={column.label}>
                    {column.label}
                  </TableHead>
                ))}
                <TableHead className="py-3.5 tracking-[0.12em]">ESTADO</TableHead>
                <TableHead className="py-3.5 text-right tracking-[0.12em]">ACCIONES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && records.map((record) => {
                const id = record.id
                const status = statusLabel(record)
                return (
                  <TableRow key={String(id)}>
                    {columns.map((column) => (
                      <TableCell className="text-sm text-slate-700" key={column.label}>
                        {column.render(record)}
                      </TableCell>
                    ))}
                    <TableCell>
                      {['profesores', 'auxiliares', 'alumnos'].includes(module) && status ? (
                        <label>
                          <span className="sr-only">Estado de registro</span>
                          <select
                            value={status.active ? 'true' : 'false'}
                            disabled={workingId === id}
                            onChange={(event) => {
                              void handleStatusChange(record, event.target.value === 'true')
                            }}
                            className={`h-9 min-w-28 rounded-lg border px-3 text-xs font-medium outline-none transition focus:ring-4 focus:ring-emerald-600/10 disabled:cursor-wait disabled:opacity-60 ${
                              status.active
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-slate-200 bg-slate-100 text-slate-600'
                            }`}
                          >
                            <option value="true">Activo</option>
                            <option value="false">Inactivo</option>
                          </select>
                        </label>
                      ) : status ? (
                        <Badge variant={status.active ? 'default' : 'secondary'} className="h-auto gap-1.5 py-1">
                          <span className={`h-1.5 w-1.5 rounded-full ${status.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {status.label}
                        </Badge>
                      ) : <span className="text-slate-300">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {module === 'alumnos' && (
                          <Button
                            type="button"
                            onClick={() => setQrStudent(record)}
                            variant="ghost"
                            size="icon"
                            className="text-emerald-800 hover:bg-emerald-50"
                            title="Ver QR"
                            aria-label={`Ver QR de ${personName(record)}`}
                          >
                            <QrCode aria-hidden="true" />
                          </Button>
                        )}
                        {module !== 'horarios' || record.activo !== false ? (
                          <Button
                            type="button"
                            onClick={() => openEdit(record)}
                            variant="ghost"
                            size="icon"
                            className="text-emerald-800 hover:bg-emerald-50"
                            title="Editar"
                            aria-label="Editar registro"
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                        ) : null}
                        {!['profesores', 'auxiliares', 'alumnos'].includes(module) && (
                          <Button
                            type="button"
                            onClick={() => handleDelete(record)}
                            disabled={workingId === id}
                            variant="ghost"
                            size="icon"
                            className="text-rose-700 hover:bg-rose-50"
                            title="Eliminar"
                            aria-label={`Eliminar ${moduleTitles[module].toLocaleLowerCase()}`}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}

              {isLoading && (
                <tr>
                  <TableCell className="py-14 text-center text-sm text-slate-500" colSpan={columns.length + 2}>
                    <span className="mx-auto mb-3 block h-6 w-6 animate-spin rounded-full border-2 border-emerald-700/20 border-t-emerald-700" />
                    Cargando registros…
                  </TableCell>
                </tr>
              )}

              {!isLoading && !error && records.length === 0 && (
                <tr>
                  <TableCell className="py-16 text-center" colSpan={columns.length + 2}>
                    <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-xl text-slate-400">⌕</span>
                    <strong className="block text-sm font-semibold text-slate-700">No hay registros para mostrar</strong>
                    <span className="mt-1 block text-xs text-slate-500">
                      {query ? 'Prueba con otro término de búsqueda.' : `Crea el primer registro de ${moduleTitles[module].toLocaleLowerCase()}.`}
                    </span>
                  </TableCell>
                </tr>
              )}
            </TableBody>
          </Table>
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span className="text-xs text-slate-500">
            Página {page} de {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => {
                setPage((current) => Math.max(1, current - 1))
              }}
              disabled={page <= 1 || isLoading}
            >
              Anterior
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => {
                setPage((current) => Math.min(pageCount, current + 1))
              }}
              disabled={page >= pageCount || isLoading}
            >
              Siguiente
            </button>
          </div>
        </footer>
      </div>

      {isFormOpen && (
        <RecordForm
          key={`${module}-${editingRecord?.id ?? 'new'}`}
          module={module}
          record={editingRecord}
          options={options}
          isSaving={isSaving}
          error={formError}
          onClose={closeForm}
          onSave={saveRecord}
        />
      )}
      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Eliminar registro
            </AlertDialogTitle>
            <AlertDialogDescription>
              Si continúas, el registro dejará de aparecer en este listado. ¿Deseas eliminarlo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmPendingAction()}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={qrStudent !== null} onOpenChange={(open) => { if (!open) setQrStudent(null) }}>
        <DialogContent className="max-w-sm p-6">
          <div className="text-center">
            <DialogTitle>QR del alumno</DialogTitle>
            <DialogDescription className="mt-1">
              Este código identifica al alumno al registrar su ingreso al colegio.
            </DialogDescription>
            {qrStudent && getText(qrStudent, 'codigo') ? (
              <>
                <div className="mx-auto mt-5 inline-flex rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <QRCodeSVG
                    value={getText(qrStudent, 'codigo')}
                    size={220}
                    level="M"
                    includeMargin
                    title={`Código QR de ${personName(qrStudent)}`}
                  />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-800">{personName(qrStudent)}</p>
                <p className="mt-1 font-mono text-sm tracking-wider text-slate-500">{getText(qrStudent, 'codigo')}</p>
                <div className="mt-5 flex justify-center gap-2">
                  <Button variant="outline" onClick={() => void copyStudentCode()}>
                    <Copy aria-hidden="true" />
                    Copiar código
                  </Button>
                  <DialogClose asChild>
                    <Button>Cerrar</Button>
                  </DialogClose>
                </div>
              </>
            ) : (
              <p className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Este alumno no tiene un código asignado; no se puede generar el QR.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

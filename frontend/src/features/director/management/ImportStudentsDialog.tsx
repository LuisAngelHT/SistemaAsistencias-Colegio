import { useRef, useState, type ChangeEvent } from 'react'
import { Download, FileSpreadsheet, FileUp, LoaderCircle, Upload, X } from 'lucide-react'
import readXlsxFile, { type Row } from 'read-excel-file/browser'
import { toast } from 'sonner'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog'
import { downloadCsv } from '../../../lib/csv'
import { importStudents, type ImportedStudent } from './managementService'

type StudentRow = {
  alumno: string
  dni: string
  fechaNacimiento: string
}

const columnAliases: Record<string, keyof StudentRow> = {
  dni: 'dni',
  documento: 'dni',
  numerodedocumento: 'dni',
  alumno: 'alumno',
  nombrecompleto: 'alumno',
  fechanacimiento: 'fechaNacimiento',
  fechadenacimiento: 'fechaNacimiento',
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function cellText(value: Row[number]): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function dateText(value: Row[number]): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000)
    return date.toISOString().slice(0, 10)
  }
  const text = cellText(value)
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  return text
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function rowsFromSheet(sheet: Row[]): StudentRow[] {
  if (sheet.length < 2) throw new Error('El archivo no contiene alumnos para importar.')
  const headers = new Map<string, number>()
  sheet[0].forEach((value, index) => {
    const key = columnAliases[normalizeHeader(value)]
    if (key) headers.set(key, index)
  })
  if (!headers.has('alumno') || !headers.has('dni') || !headers.has('fechaNacimiento')) {
    throw new Error('La primera fila debe incluir las columnas Alumno, DNI y Fecha de nacimiento.')
  }

  const records = sheet.slice(1)
    .map((cells) => {
      const read = (key: keyof StudentRow) => {
        const index = headers.get(key)
        return index === undefined ? '' : cells[index]
      }
      return {
        alumno: cellText(read('alumno')),
        dni: cellText(read('dni')).replace(/\.0$/, ''),
        fechaNacimiento: dateText(read('fechaNacimiento')),
      }
    })
    .filter((row) => row.dni || row.alumno || row.fechaNacimiento)
  if (records.length > 500) throw new Error('El archivo no puede superar los 500 alumnos por carga.')
  return records
}

function parseCsv(content: string): Row[] {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
    ? ';'
    : ','
  const rows: Row[] = []
  let row: Row = []
  let cell = ''
  let quoted = false
  const text = content.replace(/^\uFEFF/, '')

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      row.push(cell)
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }
  row.push(cell)
  if (row.some((value) => value !== '')) rows.push(row)
  if (quoted) throw new Error('El CSV contiene una celda con comillas sin cerrar.')
  return rows
}

function validationIssues(records: StudentRow[]) {
  const issues: string[] = []
  const dnis = new Set<string>()
  records.forEach((row, index) => {
    const line = index + 2
    if (!/^\d{8,15}$/.test(row.dni)) issues.push(`Fila ${line}: DNI debe tener entre 8 y 15 dígitos.`)
    if (!row.alumno.trim()) issues.push(`Fila ${line}: falta el nombre del alumno.`)
    else if (row.alumno.trim().split(/\s+/).length < 2) {
      issues.push(`Fila ${line}: escribe al menos nombres y un apellido en la columna Alumno.`)
    }
    if (row.alumno.length > 200) issues.push(`Fila ${line}: el nombre del alumno supera los 200 caracteres.`)
    if (!row.fechaNacimiento) issues.push(`Fila ${line}: falta la fecha de nacimiento.`)
    else if (!isValidDate(row.fechaNacimiento)) {
      issues.push(`Fila ${line}: fecha de nacimiento no válida; usa AAAA-MM-DD o DD/MM/AAAA.`)
    }
    if (row.dni && dnis.has(row.dni)) issues.push(`Fila ${line}: DNI repetido en el archivo.`)
    if (row.dni) dnis.add(row.dni)
  })
  return issues
}

function downloadFamilyCodes(students: ImportedStudent[]) {
  downloadCsv(
    `siga-codigos-familiares-${new Date().toISOString().slice(0, 10)}.csv`,
    ['DNI', 'Código alumno', 'Alumno', 'Código de acceso familiar'],
    students.map((student) => [
      String(student.dni ?? ''),
      String(student.codigo ?? ''),
      `${String(student.nombres ?? '')} ${String(student.apellidos ?? '')}`.trim(),
      student.codigoAccesoFamilia,
    ]),
  )
}

export function ImportStudentsDialog({
  onClose,
  onImported,
}: {
  onClose: () => void
  onImported: () => Promise<void>
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [students, setStudents] = useState<StudentRow[]>([])
  const [issues, setIssues] = useState<string[]>([])
  const [imported, setImported] = useState<ImportedStudent[]>([])
  const [isReading, setIsReading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const loadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''
    setFileName(file.name)
    setImported([])
    setStudents([])
    setIssues([])
    const isCsv = file.name.toLowerCase().endsWith('.csv')
    if (!isCsv && !file.name.toLowerCase().endsWith('.xlsx')) {
      setIssues(['Selecciona un archivo Excel .xlsx o una plantilla .csv.'])
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setIssues(['El archivo no puede superar los 5 MB.'])
      return
    }
    setIsReading(true)
    try {
      const sheet = isCsv
        ? parseCsv(await file.text())
        : (await readXlsxFile(file, { dateFormat: 'yyyy-mm-dd' }))[0]?.data ?? []
      const records = rowsFromSheet(sheet)
      const errors = validationIssues(records)
      setStudents(records)
      setIssues(errors.slice(0, 12))
      if (errors.length > 12) {
        setIssues((current) => [...current, `Hay ${errors.length - 12} errores adicionales.`])
      }
    } catch (error) {
      setIssues([error instanceof Error ? error.message : 'No se pudo leer el archivo Excel.'])
    } finally {
      setIsReading(false)
    }
  }

  const startImport = async () => {
    if (!students.length || issues.length || isImporting) return
    setIsImporting(true)
    try {
      const created = await importStudents(students)
      setImported(created)
      await onImported()
      toast.success(`${created.length} alumnos registrados.`, {
        description: 'Descarga y entrega a las familias sus códigos de acceso.',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo importar a los alumnos.'
      setIssues([message])
      toast.error(message)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !isImporting) onClose() }}>
      <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7">
          <div className="flex gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-800">
              <FileSpreadsheet className="size-5" aria-hidden="true" />
            </span>
            <div>
              <DialogTitle className="text-xl">Carga masiva de alumnos</DialogTitle>
              <DialogDescription className="mt-1">
                Importa hasta 500 registros desde una hoja de Excel .xlsx.
              </DialogDescription>
            </div>
          </div>
          <DialogClose aria-label="Cerrar carga masiva" disabled={isImporting}><X className="size-5" /></DialogClose>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
          {imported.length ? (
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
              <h3 className="font-semibold text-teal-950">Importación completada</h3>
              <p className="mt-1 text-sm text-teal-800">
                Se registraron {imported.length} alumnos. Guarda el archivo con sus accesos familiares; el sistema solo muestra estos códigos una vez.
              </p>
              <Button className="mt-4" onClick={() => downloadFamilyCodes(imported)}>
                <Download aria-hidden="true" />
                Descargar DNI y códigos familiares
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                <p className="text-sm font-semibold text-slate-800">Columnas necesarias</p>
                <p className="mt-1 text-sm text-slate-600">
                  Alumno, DNI y Fecha de nacimiento. Escribe nombres y apellidos juntos en Alumno; el último término se guardará como apellido. La fecha puede escribirse como AAAA-MM-DD o DD/MM/AAAA. Formatea el DNI como texto para conservar ceros iniciales. El código de alumno, el código de acceso de 4 dígitos y el QR se generan automáticamente; el alumno queda activo.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => downloadCsv('plantilla-alumnos-siga.csv', [
                    'Alumno', 'DNI', 'Fecha de nacimiento',
                  ], [])}
                >
                  <Download aria-hidden="true" />
                  Descargar plantilla compatible con Excel
                </Button>
              </div>

              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="sr-only"
                onChange={(event) => void loadFile(event)}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={isReading || isImporting}
                className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/50 px-5 py-8 text-center transition hover:border-teal-400 hover:bg-teal-50 disabled:opacity-60"
              >
                {isReading ? <LoaderCircle className="size-7 animate-spin text-teal-700" /> : <FileUp className="size-7 text-teal-700" />}
                <span className="mt-3 text-sm font-semibold text-slate-800">
                  {fileName || 'Seleccionar archivo Excel'}
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  {isReading ? 'Validando columnas y datos…' : '                  Archivo .xlsx o .csv de hasta 5 MB'}
                </span>
              </button>

              {students.length > 0 && !issues.length && (
                <div className="rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm text-teal-900">
                  <strong>{students.length} alumnos listos</strong>
                  <span className="ml-1">· Todos los DNI tienen el formato esperado.</span>
                </div>
              )}
              {issues.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
                  {issues.map((issue) => <p key={issue}>{issue}</p>)}
                </div>
              )}
              {students.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[560px] text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr><th className="px-3 py-2">Alumno</th><th className="px-3 py-2">DNI</th><th className="px-3 py-2">Fecha de nacimiento</th></tr>
                    </thead>
                    <tbody>
                      {students.slice(0, 5).map((student) => (
                        <tr className="border-t border-slate-100" key={`${student.dni}-${student.alumno}`}>
                          <td className="px-3 py-2">{student.alumno}</td>
                          <td className="px-3 py-2 font-mono">{student.dni}</td>
                          <td className="px-3 py-2">{student.fechaNacimiento}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {students.length > 5 && <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">Mostrando 5 de {students.length} registros.</p>}
                </div>
              )}
            </>
          )}
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
          {imported.length ? (
            <>
              <Button variant="outline" onClick={onClose}>Cerrar</Button>
              <Button onClick={() => downloadFamilyCodes(imported)}><Download aria-hidden="true" />Descargar accesos</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={isImporting}>Cancelar</Button>
              <Button onClick={() => void startImport()} disabled={!students.length || Boolean(issues.length) || isReading || isImporting}>
                {isImporting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
                {isImporting ? 'Registrando…' : `Importar ${students.length || ''} alumnos`}
              </Button>
            </>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  )
}

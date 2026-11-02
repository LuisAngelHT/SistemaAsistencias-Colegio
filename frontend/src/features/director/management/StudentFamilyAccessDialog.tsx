import { useEffect, useRef, useState } from 'react'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../../components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../../../components/ui/dialog'
import { generateStudentFamilyCode } from './managementService'

type FamilyStudent = {
  id: string
  nombres: string
  apellidos: string
  dni: string
}

export function StudentFamilyAccessDialog({
  student,
  initialAccessCode,
  onClose,
}: {
  student: FamilyStudent | null
  initialAccessCode?: string
  onClose: () => void
}) {
  const [accessCode, setAccessCode] = useState(initialAccessCode ?? '')
  const [isGenerating, setIsGenerating] = useState(
    !initialAccessCode && Boolean(student?.id && student.dni),
  )
  const generationRef = useRef<{
    studentId: string
    promise: ReturnType<typeof generateStudentFamilyCode>
  } | null>(null)
  const studentId = student?.id

  useEffect(() => {
    if (!studentId || initialAccessCode || !student?.dni) return

    let active = true
    let generation = generationRef.current
    if (!generation || generation.studentId !== studentId) {
      generation = {
        studentId,
        promise: generateStudentFamilyCode(studentId),
      }
      generationRef.current = generation
    }

    void generation.promise
      .then((result) => {
        if (active) setAccessCode(result.codigoAccesoFamilia)
      })
      .catch((error: unknown) => {
        if (active) toast.error(error instanceof Error ? error.message : 'No se pudo generar el código.')
      })
      .finally(() => {
        if (active) setIsGenerating(false)
        if (generationRef.current === generation) generationRef.current = null
      })

    return () => {
      active = false
    }
  }, [initialAccessCode, student?.dni, studentId])

  const generateCode = async () => {
    if (!studentId) return
    setIsGenerating(true)
    try {
      const result = await generateStudentFamilyCode(studentId)
      setAccessCode(result.codigoAccesoFamilia)
      toast.success('Código nuevo generado. El código anterior dejó de funcionar.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo generar el código.')
    } finally {
      setIsGenerating(false)
    }
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(accessCode)
      toast.success('Código copiado.')
    } catch {
      toast.error('No se pudo copiar. Selecciona el código para copiarlo manualmente.')
    }
  }

  return (
    <Dialog open={student !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md p-6">
        <DialogTitle>Código de acceso familiar</DialogTitle>
        <DialogDescription className="mt-2">
          {student
            ? `${student.nombres} ${student.apellidos} · DNI ${student.dni || 'no registrado'}`
            : ''}
          {student?.dni
            ? ' Al abrir esta opción se genera un código nuevo y el anterior deja de funcionar.'
            : ''}
        </DialogDescription>
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-950">
            Comparte el DNI del alumno y este código de 4 dígitos con la familia.
          </p>
          {accessCode ? (
            <div className="mt-4 flex items-center justify-center gap-3">
              <code className="rounded-lg border border-emerald-200 bg-white px-4 py-2 font-mono text-3xl font-bold tracking-[0.3em] text-slate-900">
                {accessCode}
              </code>
              <Button type="button" variant="outline" size="icon" onClick={() => void copyCode()} aria-label="Copiar código">
                <Copy aria-hidden="true" />
              </Button>
            </div>
          ) : isGenerating ? (
            <p className="mt-4 text-center text-sm text-emerald-800">Generando código…</p>
          ) : student?.dni ? (
            <p className="mt-4 text-center text-sm text-amber-800" role="alert">
              No se pudo cargar el código. Intenta generarlo nuevamente.
            </p>
          ) : (
            <p className="mt-4 text-center text-sm text-amber-800">
              Registra el DNI del alumno para habilitar el acceso familiar.
            </p>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Por seguridad, el código se guarda como hash y no se puede recuperar. Al abrir esta opción para un alumno ya registrado se genera uno nuevo y se invalida el anterior.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          {student?.dni && (
            <Button type="button" variant="outline" onClick={() => void generateCode()} disabled={isGenerating}>
              {accessCode ? 'Generar otro' : 'Reintentar'}
            </Button>
          )}
          <DialogClose asChild>
            <Button type="button">Cerrar</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import {
  getPendingRequests,
  pendingRequestCountKey,
  pendingRequestsKey,
  reviewRequest,
  type JustificationRequest,
} from './justificationRequestsService'

const noRequests: JustificationRequest[] = []

export function FamilyRequestsPanel({ onBack }: { onBack: () => void }) {
  const queryClient = useQueryClient()
  const [busyIds, setBusyIds] = useState<string[]>([])
  const knownIds = useRef<Set<string> | null>(null)
  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: pendingRequestsKey,
    queryFn: getPendingRequests,
    refetchInterval: 15000,
  })
  const requests = data ?? noRequests

  useEffect(() => {
    if (isPending) return
    const currentIds = new Set(requests.map((request) => request.id))
    if (knownIds.current) {
      for (const request of requests) {
        if (!knownIds.current.has(request.id)) {
          toast.info(`Nueva solicitud de ${request.alumno.nombres} ${request.alumno.apellidos}.`)
        }
      }
    }
    knownIds.current = currentIds
  }, [isPending, requests])

  const decide = async (id: string, estado: 'aprobada' | 'rechazada') => {
    setBusyIds((ids) => [...ids, id])
    try {
      await reviewRequest(id, { estado })
      await queryClient.invalidateQueries({ queryKey: pendingRequestsKey })
      await queryClient.invalidateQueries({ queryKey: pendingRequestCountKey })
      toast.success(estado === 'aprobada' ? 'Justificación aprobada.' : 'Solicitud rechazada.')
    } catch (reviewError) {
      toast.error(reviewError instanceof Error ? reviewError.message : 'No se pudo revisar la solicitud.')
    } finally {
      setBusyIds((ids) => ids.filter((busyId) => busyId !== id))
    }
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <div className="mb-5 flex items-center justify-between">
        <Button variant="ghost" className="px-2 text-slate-500" onClick={onBack}><ArrowLeft aria-hidden="true" /> Volver al panel</Button>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}><RefreshCw aria-hidden="true" /> Actualizar</Button>
      </div>
      <header className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Atención a familias</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Solicitudes de justificación</h1>
        <p className="mt-2 text-sm text-slate-500">Las solicitudes nuevas se actualizan automáticamente y requieren revisión del personal.</p>
      </header>
      {error && <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error.message}</div>}
      <div className="space-y-3">
        {isPending ? <p className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Cargando solicitudes…</p>
          : requests.length ? requests.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-3 sm:flex-row">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-slate-900">{item.alumno.nombres} {item.alumno.apellidos}</h2>
                    <Badge variant="secondary">{item.tipo === 'falta_justificada' ? 'Falta' : 'Tardanza'}</Badge>
                    <Badge variant="outline">{item.fecha}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{item.seccion} · {item.alumno.codigo}</p>
                  <p className="mt-3 text-sm text-slate-700">{item.motivo}</p>
                  <p className="mt-2 text-xs text-slate-500">Enviado desde el acceso familiar del alumno.</p>
                </div>
                <div className="flex shrink-0 gap-2 sm:self-start">
                  <Button size="sm" onClick={() => void decide(item.id, 'aprobada')} disabled={busyIds.includes(item.id)}><Check aria-hidden="true" /> Aprobar</Button>
                  <Button size="sm" variant="outline" onClick={() => void decide(item.id, 'rechazada')} disabled={busyIds.includes(item.id)}><X aria-hidden="true" /> Rechazar</Button>
                </div>
              </div>
            </article>
          )) : <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No hay solicitudes pendientes.</p>}
      </div>
    </section>
  )
}

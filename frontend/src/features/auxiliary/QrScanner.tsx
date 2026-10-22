import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'
import { Camera, CameraOff, X } from 'lucide-react'
import { Button } from '../../components/ui/button'

export function QrScanner({
  onCode,
  onClose,
}: {
  onCode: (code: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onCodeRef = useRef(onCode)
  const onCloseRef = useRef(onClose)
  const [cameraError, setCameraError] = useState('')
  const [isStarting, setIsStarting] = useState(true)

  useEffect(() => {
    onCodeRef.current = onCode
    onCloseRef.current = onClose
  }, [onCode, onClose])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let isMounted = true
    let scanned = false
    let controls: IScannerControls | undefined
    const reader = new BrowserMultiFormatReader()

    void reader.decodeFromConstraints(
      { video: { facingMode: 'environment' } },
      video,
      (result, _error, scanControls) => {
        controls = scanControls
        if (!isMounted) {
          scanControls.stop()
          return
        }
        if (result && !scanned) {
          scanned = true
          scanControls.stop()
          onCodeRef.current(result.getText())
        }
        setIsStarting(false)
      },
    ).then((scanControls) => {
      controls = scanControls
      if (!isMounted) scanControls.stop()
    }).catch((error: unknown) => {
      if (!isMounted) return
      setIsStarting(false)
      setCameraError(
        error instanceof Error
          ? error.message
          : 'No se pudo iniciar la cámara. Comprueba los permisos del navegador.',
      )
    })

    return () => {
      isMounted = false
      controls?.stop()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white" role="dialog" aria-modal="true" aria-label="Lector de código QR">
      <header className="flex items-center justify-between px-4 py-4">
        <span className="flex items-center gap-2 font-semibold"><Camera className="size-5" /> Escanear código del alumno</span>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" onClick={() => onCloseRef.current()} aria-label="Cerrar lector">
          <X />
        </Button>
      </header>
      <div className="relative mx-auto flex w-full max-w-xl flex-1 items-center justify-center overflow-hidden px-4 pb-8">
        <video ref={videoRef} className="max-h-full w-full rounded-2xl object-cover" muted playsInline />
        {!cameraError && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[min(68vw,300px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(2,6,23,0.42)]">
            <span className="absolute -top-0.5 left-4 right-4 h-0.5 animate-pulse bg-emerald-400" />
          </div>
        )}
        {isStarting && !cameraError && (
          <p className="absolute bottom-10 rounded-full bg-slate-900/80 px-4 py-2 text-sm">Iniciando cámara…</p>
        )}
        {cameraError && (
          <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 rounded-2xl border border-rose-300/30 bg-slate-900/95 p-6 text-center">
            <CameraOff className="mx-auto size-9 text-rose-300" />
            <p className="mt-3 text-sm font-semibold">No se pudo abrir la cámara</p>
            <p className="mt-2 break-words text-xs text-slate-300">{cameraError}</p>
            <p className="mt-3 text-xs text-slate-400">Permite el acceso a la cámara y usa HTTPS o localhost.</p>
            <Button className="mt-5" onClick={() => onCloseRef.current()}>Cerrar</Button>
          </div>
        )}
      </div>
      <p className="pb-8 text-center text-sm text-slate-300">Centra el código QR dentro del marco</p>
    </div>
  )
}

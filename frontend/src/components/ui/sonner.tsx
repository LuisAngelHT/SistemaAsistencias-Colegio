import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { Check, CircleAlert, Info, LoaderCircle, TriangleAlert } from 'lucide-react'

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <Check className="size-4" />,
        info: <Info className="size-4" />,
        warning: <TriangleAlert className="size-4" />,
        error: <CircleAlert className="size-4" />,
        loading: <LoaderCircle className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: 'border border-slate-200 bg-white text-slate-800 shadow-lg',
          title: 'font-semibold',
          description: 'text-slate-500',
          success: 'border-emerald-200',
          error: 'border-rose-200',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

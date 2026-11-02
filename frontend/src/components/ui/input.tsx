import * as React from 'react'
import { cn } from '../../lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        'h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm shadow-slate-900/[0.02] outline-none transition-all placeholder:text-slate-400 focus-visible:border-teal-600 focus-visible:ring-4 focus-visible:ring-teal-600/10 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }

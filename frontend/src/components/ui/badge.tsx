import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex h-5 w-fit items-center justify-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-emerald-50 text-emerald-800',
        secondary: 'bg-slate-100 text-slate-700',
        destructive: 'bg-rose-50 text-rose-700',
        outline: 'border border-slate-200 text-slate-700',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge }

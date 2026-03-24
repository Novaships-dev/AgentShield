import { clsx } from 'clsx'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
}

export default function GlassCard({ children, className, hover = false }: GlassCardProps) {
  return (
    <div className={clsx(hover ? 'glass-hover' : 'glass', 'p-6', className)}>
      {children}
    </div>
  )
}

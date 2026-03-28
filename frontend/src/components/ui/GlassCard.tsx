import { clsx } from 'clsx'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  style?: React.CSSProperties
}

export default function GlassCard({ children, className, hover = false, style }: GlassCardProps) {
  return (
    <div className={clsx(hover ? 'glass-hover' : 'glass', 'p-6', className)} style={style}>
      {children}
    </div>
  )
}

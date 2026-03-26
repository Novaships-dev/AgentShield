type Module = 'monitor' | 'replay' | 'protect'

const CONFIG: Record<Module, { label: string; color: string }> = {
  monitor: { label: 'M', color: '#7C3AED' },
  replay:  { label: 'R', color: '#06B6D4' },
  protect: { label: 'P', color: '#F59E0B' },
}

export default function ModuleBadge({ module }: { module: Module }) {
  const { label, color } = CONFIG[module]
  return (
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold flex-shrink-0"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {label}
    </span>
  )
}

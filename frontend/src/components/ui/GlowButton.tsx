'use client'

import { clsx } from 'clsx'

interface GlowButtonProps {
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  className?: string
}

export default function GlowButton({
  children,
  variant = 'primary',
  onClick,
  disabled = false,
  type = 'button',
  className,
}: GlowButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary' && [
          'text-white',
          'focus:ring-violet-500 focus:ring-offset-gray-900',
        ],
        variant === 'secondary' && [
          'glass',
          'focus:ring-cyan-500 focus:ring-offset-gray-900',
        ],
        className,
      )}
      style={
        variant === 'primary'
          ? {
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              boxShadow: disabled ? 'none' : '0 0 20px var(--glow)',
            }
          : {
              color: 'var(--text-secondary)',
            }
      }
    >
      {children}
    </button>
  )
}

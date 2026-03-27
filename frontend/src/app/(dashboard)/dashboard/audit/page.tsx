'use client'

import { Shield } from 'lucide-react'
import AuditLog from '@/components/dashboard/AuditLog'

export default function AuditPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6" style={{ color: 'var(--accent)' }} />
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Audit Log</h1>
      </div>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Immutable record of all admin actions in your organization.
      </p>
      <AuditLog />
    </div>
  )
}

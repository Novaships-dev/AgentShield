'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import ReportGenerator from '@/components/dashboard/ReportGenerator'
import ReportList from '@/components/dashboard/ReportList'

export default function ReportsPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="w-6 h-6" style={{ color: 'var(--accent)' }} />
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Reports</h1>
      </div>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Generate PDF reports with cost breakdown, violations summary, and forecasts.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ReportGenerator onGenerated={() => setRefreshKey(k => k + 1)} />
        </div>
        <div className="lg:col-span-2">
          <ReportList refreshKey={refreshKey} monthlyUsage={0} />
        </div>
      </div>
    </div>
  )
}

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Analytics — AgentShield Admin',
}

const LOOKER_URL =
  'https://lookerstudio.google.com/embed/reporting/422e5a11-6783-45e7-ac00-780a5db2ed6e/page/TkwtF'

export default function AdminAnalyticsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h1
          style={{
            color: '#e2d9f3',
            fontSize: 24,
            fontWeight: 700,
            margin: '0 0 6px',
            letterSpacing: '-0.5px',
          }}
        >
          Marketing Analytics
        </h1>
        <p style={{ color: '#6b5c8a', fontSize: 14, margin: 0 }}>
          Traffic et performance de agentshield.one — données Google Analytics
        </p>
      </div>

      {/* Looker Studio iframe */}
      <div
        style={{
          background: '#0f0a1e',
          border: '1px solid #2a1f4e',
          borderRadius: 12,
          overflow: 'hidden',
          width: '100%',
          height: 'calc(100vh - 180px)',
          minHeight: 600,
        }}
      >
        <iframe
          src={LOOKER_URL}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          allowFullScreen
          title="AgentShield Marketing Analytics"
        />
      </div>
    </div>
  )
}

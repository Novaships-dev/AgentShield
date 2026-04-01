'use client'

import { useState } from 'react'

export default function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function handleSubmit() {
    if (!email || !email.includes('@')) return
    setStatus('loading')
    try {
      const res = await fetch('https://api.agentshield.one/v1/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setStatus(res.ok ? 'success' : 'error')
      if (res.ok) setEmail('')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div style={{ maxWidth: 440 }}>
      <p style={{
        color: '#e2d9f3',
        fontWeight: 600,
        fontSize: 15,
        margin: '0 0 6px',
      }}>
        Stay in the loop
      </p>
      <p style={{
        color: '#6b5c8a',
        fontSize: 13,
        margin: '0 0 14px',
        lineHeight: 1.5,
      }}>
        AI monitoring tips and product updates. No spam.
      </p>

      {status === 'success' ? (
        <p style={{ color: '#a78bfa', fontWeight: 600, fontSize: 14 }}>
          ✓ You&apos;re on the list!
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="you@company.com"
              disabled={status === 'loading'}
              style={{
                flex: '1 1 180px',
                background: '#0f0a1e',
                border: '1px solid #2a1f4e',
                borderRadius: 8,
                padding: '9px 14px',
                color: '#e2d9f3',
                fontSize: 14,
                outline: 'none',
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={status === 'loading'}
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '9px 18px',
                fontWeight: 600,
                fontSize: 14,
                cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                opacity: status === 'loading' ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {status === 'loading' ? '...' : 'Subscribe →'}
            </button>
          </div>
          {status === 'error' && (
            <p style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>
              Something went wrong. Please try again.
            </p>
          )}
        </>
      )}
    </div>
  )
}

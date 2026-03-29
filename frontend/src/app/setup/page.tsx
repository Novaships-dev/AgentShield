'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
async function getAuthHeader(): Promise<Record<string, string>> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {}
}

const STEPS = ['Welcome', 'API Key', 'Install SDK', 'First Event', 'Dashboard']

// ── Step 1: Welcome ─────────────────────────────────────────────────────────
function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center space-y-8">
      <div className="text-5xl mb-2">🛡️</div>
      <h1 className="text-3xl font-bold" style={{ color: '#fff' }}>
        Welcome to AgentShield
      </h1>
      <p className="text-base max-w-sm mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Let's monitor your first AI agent in 2 minutes.
      </p>
      <div className="space-y-3 text-sm text-left max-w-xs mx-auto">
        {[
          'Set up your API key',
          'Install the SDK in one command',
          'See your first event in real-time',
        ].map(item => (
          <div key={item} className="flex items-center gap-3">
            <span style={{ color: '#4ade80' }}>✓</span>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>{item}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onNext}
        className="px-8 py-3 rounded-xl text-sm font-medium"
        style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', color: '#fff' }}
      >
        Continue →
      </button>
    </div>
  )
}

// ── Step 2: API Key ──────────────────────────────────────────────────────────
function StepApiKey({ onNext }: { onNext: () => void }) {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchKeys = async () => {
      try {
        const headers = await getAuthHeader()
        const r = await fetch(`${API_BASE}/v1/api-keys`, { headers })
        const keys: Array<{ key_preview: string; id: string }> = await r.json()
        if (keys.length > 0) {
          setApiKey(null) // Only show generated keys, not previews
          setLoading(false)
        } else {
          const postHeaders = await getAuthHeader()
          const r2 = await fetch(`${API_BASE}/v1/api-keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...postHeaders },
            body: JSON.stringify({ name: 'Default' }),
          })
          const d: { key?: string; detail?: string } = await r2.json()
          if (d.key) setApiKey(d.key)
          else setError(d.detail ?? 'Failed to create API key')
          setLoading(false)
        }
      } catch {
        setError('Failed to load API keys')
        setLoading(false)
      }
    }
    fetchKeys()
  }, [])

  const copy = () => {
    if (!apiKey) return
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-4xl mb-3">🔑</div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: '#fff' }}>Your API Key</h2>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Copy this key — you won't see it again.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8" style={{ color: 'rgba(255,255,255,0.4)' }}>Generating key…</div>
      ) : error ? (
        <div className="text-center py-4 text-sm" style={{ color: '#f87171' }}>{error}</div>
      ) : apiKey ? (
        <>
          <div
            className="rounded-xl p-4 font-mono text-xs break-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#a78bfa' }}
          >
            {apiKey}
          </div>

          <div
            className="flex items-start gap-3 rounded-xl p-4 text-xs"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            <span>⚠️</span>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>
              Save this key somewhere safe. It cannot be retrieved after this step.
            </span>
          </div>

          <button
            onClick={copy}
            className="w-full py-3 rounded-xl text-sm font-medium transition-all"
            style={{
              background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(124,58,237,0.15)',
              border: `1px solid ${copied ? 'rgba(74,222,128,0.3)' : 'rgba(124,58,237,0.3)'}`,
              color: copied ? '#4ade80' : '#a78bfa',
            }}
          >
            {copied ? '✓ Copied!' : 'Copy Key'}
          </button>
        </>
      ) : (
        <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          You already have an API key. Check Settings → API Keys to view it.
        </p>
      )}

      <button
        onClick={onNext}
        disabled={!!apiKey && !copied}
        className="w-full py-3 rounded-xl text-sm font-medium"
        style={{
          background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
          color: '#fff',
          opacity: apiKey && !copied ? 0.4 : 1,
        }}
      >
        I've saved it →
      </button>
    </div>
  )
}

// ── Step 3: Install SDK ──────────────────────────────────────────────────────
const SDK_TABS = [
  {
    label: 'Python SDK',
    code: `# Install\npip install agentshield\n\n# Set your API key\nexport AGENTSHIELD_API_KEY="ags_live_..."\n\n# Wrap your agent\nimport agentshield as shield\n\n@shield(agent="my-agent")\ndef run_agent(query):\n    # Your existing code here\n    ...`,
  },
  {
    label: 'LangChain',
    code: `pip install agentshield\n\nfrom agentshield.integrations.langchain import AgentShieldCallback\n\ncallback = AgentShieldCallback(\n    agent_name="my-langchain-agent"\n)\n\n# Add to your chain\nchain.run(query, callbacks=[callback])`,
  },
  {
    label: 'CrewAI',
    code: `pip install agentshield\n\nfrom agentshield.integrations.crewai import AgentShieldCrewCallback\n\ncallback = AgentShieldCrewCallback(\n    agent_name="my-crew"\n)\n\ncrew = Crew(\n    agents=[...],\n    tasks=[...],\n    callbacks=[callback]\n)`,
  },
  {
    label: 'API Direct',
    code: `import requests\n\nrequests.post(\n    "https://api.agentshield.one/v1/events",\n    headers={"Authorization": "Bearer ags_live_..."},\n    json={\n        "agent": "my-agent",\n        "model": "gpt-4o",\n        "prompt_tokens": 100,\n        "completion_tokens": 50,\n        "cost_usd": 0.0025\n    }\n)`,
  },
  {
    label: 'cURL',
    code: `curl -X POST https://api.agentshield.one/v1/events \\\n  -H "Authorization: Bearer ags_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"agent":"my-agent","model":"gpt-4o","prompt_tokens":100,"completion_tokens":50,"cost_usd":0.0025}'`,
  },
]

function StepInstall({ onNext }: { onNext: () => void }) {
  const [tab, setTab] = useState(0)

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-4xl mb-3">📦</div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: '#fff' }}>Install the SDK</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {SDK_TABS.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setTab(i)}
            className="px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={{
              background: tab === i ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${tab === i ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.06)'}`,
              color: tab === i ? '#a78bfa' : 'rgba(255,255,255,0.5)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Code */}
      <div
        className="rounded-xl p-4 font-mono text-xs overflow-x-auto whitespace-pre"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#a78bfa', lineHeight: '1.8' }}
      >
        {SDK_TABS[tab].code}
      </div>

      <button
        onClick={onNext}
        className="w-full py-3 rounded-xl text-sm font-medium"
        style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', color: '#fff' }}
      >
        I've installed it →
      </button>
    </div>
  )
}

// ── Step 4: First Event ──────────────────────────────────────────────────────
type EventData = { agent?: string; model?: string; cost_usd?: number }

function StepFirstEvent({ onNext }: { onNext: () => void }) {
  const [status, setStatus] = useState<'waiting' | 'received' | 'timeout'>('waiting')
  const [event, setEvent] = useState<EventData | null>(null)

  useEffect(() => {
    let attempts = 0
    const maxAttempts = 30 // 60s total

    const poll = async () => {
      try {
        const headers = await getAuthHeader()
        const r = await fetch(`${API_BASE}/v1/events?limit=1`, { headers })
        const d = await r.json()
        if (Array.isArray(d) && d.length > 0) {
          setEvent(d[0])
          setStatus('received')
          return
        }
      } catch { /* continue polling */ }

      attempts++
      if (attempts >= maxAttempts) {
        setStatus('timeout')
        return
      }
      setTimeout(poll, 2000)
    }

    poll()
  }, [])

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-4xl mb-3">📡</div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: '#fff' }}>Send your first event</h2>
      </div>

      {status === 'waiting' && (
        <div className="text-center py-8 space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div
              className="w-3 h-3 rounded-full animate-pulse"
              style={{ background: '#7C3AED', boxShadow: '0 0 12px rgba(124,58,237,0.6)' }}
            />
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Waiting for your first event...
            </span>
          </div>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Run your agent with the SDK installed. This page updates automatically.
          </p>
        </div>
      )}

      {status === 'received' && event && (
        <div className="space-y-4">
          <div
            className="rounded-xl p-5 text-center"
            style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}
          >
            <div className="text-2xl mb-2">🎉</div>
            <p className="font-medium mb-3" style={{ color: '#4ade80' }}>Your first event is tracked!</p>
            <div className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Agent: <span style={{ color: '#fff' }}>{event.agent ?? 'unknown'}</span>
              {' | '}Model: <span style={{ color: '#fff' }}>{event.model ?? 'unknown'}</span>
              {' | '}Cost: <span style={{ color: '#fff' }}>${event.cost_usd?.toFixed(4) ?? '0.0000'}</span>
            </div>
          </div>
        </div>
      )}

      {status === 'timeout' && (
        <div
          className="rounded-xl p-4 text-sm text-center"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>No event yet?</p>
          <a href="/docs/quickstart" className="text-xs" style={{ color: '#a78bfa' }}>
            Check our troubleshooting guide →
          </a>
        </div>
      )}

      <button
        onClick={onNext}
        className="w-full py-3 rounded-xl text-sm font-medium"
        style={{
          background: status === 'received'
            ? 'linear-gradient(135deg, #7C3AED, #06B6D4)'
            : 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#fff',
        }}
      >
        {status === 'received' ? 'Continue →' : 'Skip for now →'}
      </button>
    </div>
  )
}

// ── Step 5: Done ─────────────────────────────────────────────────────────────
function StepDone() {
  return (
    <div className="text-center space-y-8">
      <div className="text-5xl mb-2">🎉</div>
      <h2 className="text-2xl font-bold" style={{ color: '#fff' }}>You're all set!</h2>
      <p className="text-sm max-w-xs mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Your dashboard is live. Here's what you can do next.
      </p>

      <div className="space-y-3 max-w-xs mx-auto">
        {[
          { label: 'Set up alerts', href: '/dashboard/alerts' },
          { label: 'Invite your team', href: '/dashboard/settings' },
          { label: 'Configure guardrails', href: '/dashboard/guardrails' },
        ].map(tip => (
          <Link
            key={tip.label}
            href={tip.href}
            className="flex items-center justify-between px-4 py-3 rounded-xl text-sm no-underline transition-colors"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            <span>{tip.label}</span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
          </Link>
        ))}
      </div>

      <button
        onClick={() => { window.location.href = '/dashboard' }}
        className="px-8 py-3 rounded-xl text-sm font-medium"
        style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', color: '#fff' }}
      >
        Go to Dashboard →
      </button>
    </div>
  )
}

// ── Main wizard ──────────────────────────────────────────────────────────────
export default function SetupPage() {
  const [step, setStep] = useState(0)

  const next = () => setStep(s => s + 1)

  const STEP_COMPONENTS = [
    <StepWelcome key={0} onNext={next} />,
    <StepApiKey key={1} onNext={next} />,
    <StepInstall key={2} onNext={next} />,
    <StepFirstEvent key={3} onNext={next} />,
    <StepDone key={4} />,
  ]

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{ background: '#030014' }}
    >
      {/* Background glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(124,58,237,0.12), transparent)' }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300"
                  style={{
                    background: i < step
                      ? '#4ade80'
                      : i === step
                        ? 'linear-gradient(135deg, #7C3AED, #06B6D4)'
                        : 'rgba(255,255,255,0.06)',
                    color: i <= step ? '#fff' : 'rgba(255,255,255,0.3)',
                    border: i === step ? 'none' : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {i < step ? '✓' : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className="flex-1 h-px mx-1 transition-all duration-300"
                    style={{
                      background: i < step ? '#4ade80' : 'rgba(255,255,255,0.08)',
                      width: '24px',
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(24px)',
          }}
        >
          {STEP_COMPONENTS[step]}
        </div>

        {/* Skip */}
        {step < STEPS.length - 1 && (
          <div className="text-center mt-6">
            <button
              onClick={() => { window.location.href = '/dashboard' }}
              className="text-xs"
              style={{ color: 'rgba(255,255,255,0.25)' }}
            >
              Skip setup →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

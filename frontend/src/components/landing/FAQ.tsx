'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const FAQS = [
  {
    q: 'Does AgentShield slow down my agents?',
    a: 'No. AgentShield tracks events asynchronously — your agent calls return immediately, with zero added latency. Events are batched and sent in the background.',
  },
  {
    q: 'Which LLM providers are supported?',
    a: 'OpenAI, Anthropic, Google (Gemini), Cohere, and any OpenAI-compatible API. Framework support: LangChain, CrewAI, AutoGen, LlamaIndex, and plain Python.',
  },
  {
    q: 'How does PII redaction work?',
    a: 'The SDK detects and redacts email addresses, phone numbers, credit card numbers, SSNs, and IP addresses before data leaves your environment. You can configure custom patterns.',
  },
  {
    q: 'Can I use AgentShield with my existing observability stack?',
    a: 'Yes. Outbound webhooks (Pro+) let you forward events to Datadog, Grafana, PagerDuty, or any HTTP endpoint. AgentShield complements — not replaces — your existing tools.',
  },
  {
    q: 'Is my data stored? For how long?',
    a: 'Event data is stored per your plan: 7 days (Free), 30 days (Starter), 90 days (Pro), 1 year (Team). Session inputs/outputs are only stored if you opt in, and always with PII redacted.',
  },
  {
    q: 'What happens when an agent exceeds its budget?',
    a: 'AgentShield raises a BudgetExceededError in your code and optionally activates the kill switch — preventing further API calls until you lift it manually or the period resets.',
  },
  {
    q: 'Can I self-host AgentShield?',
    a: 'Not yet. We are working on a self-hosted version for enterprise compliance needs. Contact us if that is a requirement.',
  },
]

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="py-24 px-8" id="faq">
      {/* Divider */}
      <div className="max-w-[700px] mx-auto mb-20">
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.2) 30%, rgba(6,182,212,0.2) 70%, transparent)' }} />
      </div>

      <style jsx>{`
        .faq-answer {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows 400ms cubic-bezier(.4,0,.2,1), opacity 400ms;
          opacity: 0;
        }
        .faq-answer.is-open {
          grid-template-rows: 1fr;
          opacity: 1;
        }
        .faq-answer > div {
          overflow: hidden;
        }
        .faq-item {
          transition: all 300ms cubic-bezier(.4,0,.2,1);
        }
        .faq-item:hover {
          background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)) !important;
        }
      `}</style>

      <div className="max-w-[700px] mx-auto">
        <div className="text-center mb-14" data-reveal>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: '#fff' }}>
            Frequently asked questions
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => {
            const isOpen = open === i
            return (
              <div
                key={i}
                data-reveal
                className="faq-item rounded-xl overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                  border: isOpen ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  borderLeft: isOpen ? '3px solid #7C3AED' : '3px solid transparent',
                  transitionDelay: `${i * 60}ms`,
                }}
              >
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                  onClick={() => setOpen(isOpen ? null : i)}
                >
                  <span className="text-sm font-medium pr-4" style={{ color: '#fff' }}>{faq.q}</span>
                  <ChevronDown
                    size={18}
                    strokeWidth={2}
                    className="flex-shrink-0 transition-transform duration-300"
                    style={{
                      color: isOpen ? '#a78bfa' : 'rgba(255,255,255,0.3)',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                    }}
                  />
                </button>
                <div className={`faq-answer ${isOpen ? 'is-open' : ''}`}>
                  <div>
                    <div className="px-5 pb-5">
                      <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{faq.a}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

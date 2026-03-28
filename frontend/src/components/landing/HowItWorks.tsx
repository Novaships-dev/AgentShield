'use client'

export default function HowItWorks() {
  return (
    <section className="py-24 px-8" id="how-it-works">
      {/* Section divider */}
      <div className="max-w-[1100px] mx-auto mb-20">
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.2) 30%, rgba(6,182,212,0.2) 70%, transparent)' }} />
      </div>

      <style jsx>{`
        /* Typing animation for Step 1 */
        @keyframes typing {
          from { width: 0; }
          to   { width: 100%; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0; }
        }
        .typing-text {
          display: inline-block;
          overflow: hidden;
          white-space: nowrap;
          border-right: 2px solid #a78bfa;
          animation: typing 2s steps(22) 0.5s forwards, blink 0.8s step-end infinite;
          width: 0;
        }
        /* Glowing connecting line */
        @keyframes lineGlow {
          0%   { background-position: 0% 0%; }
          100% { background-position: 200% 0%; }
        }
        .connect-line {
          background: linear-gradient(90deg, rgba(124,58,237,0.1) 0%, rgba(124,58,237,0.5) 50%, rgba(6,182,212,0.5) 70%, rgba(6,182,212,0.1) 100%);
          background-size: 200% 100%;
          animation: lineGlow 3s linear infinite;
        }
        /* Step number glow pulse */
        @keyframes stepPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(124,58,237,0.3); }
          50%      { box-shadow: 0 0 35px rgba(124,58,237,0.5), 0 0 60px rgba(124,58,237,0.15); }
        }
        /* Code highlight shimmer */
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        /* Dashboard counter */
        @keyframes counterUp {
          0%   { content: '$0.00'; }
          25%  { content: '$0.01'; }
          50%  { content: '$0.02'; }
          75%  { content: '$0.03'; }
          100% { content: '$0.03'; }
        }
        @keyframes dashPulse {
          0%, 100% { opacity: 0.6; }
          50%      { opacity: 1; }
        }
      `}</style>

      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-16" data-reveal>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: '#fff' }}>
            Up and running in 2 minutes.
          </h2>
          <p className="text-base max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>
            No infrastructure. No config files. No code changes to existing agents.
          </p>
        </div>

        <div className="relative">
          {/* Horizontal connecting line (desktop) */}
          <div className="absolute top-[60px] left-[16%] right-[16%] h-[2px] connect-line hidden lg:block rounded-full" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-8">
            {/* Step 1 — Install */}
            <div data-reveal className="text-center" style={{ transitionDelay: '0ms' }}>
              <div className="flex justify-center mb-8">
                <div
                  className="w-[72px] h-[72px] rounded-full flex items-center justify-center relative"
                  style={{
                    background: 'rgba(124,58,237,0.1)',
                    border: '2px solid rgba(124,58,237,0.3)',
                    animation: 'stepPulse 3s ease-in-out infinite',
                  }}
                >
                  <span className="text-2xl font-black" style={{
                    background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}>01</span>
                </div>
              </div>

              <h3 className="text-xl font-bold mb-3" style={{ color: '#fff' }}>Install the SDK</h3>
              <p className="text-sm leading-relaxed mb-6 max-w-xs mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
                One line. pip install agentshield. Works with OpenAI, Anthropic, Google, LangChain, CrewAI, and more.
              </p>

              {/* Mini terminal */}
              <div className="rounded-xl overflow-hidden max-w-xs mx-auto" style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div className="flex items-center gap-1.5 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
                  <div className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} />
                  <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
                </div>
                <div className="px-4 py-3 font-mono text-xs">
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>$ </span>
                  <span className="typing-text" style={{ color: '#a78bfa' }}>pip install agentshield</span>
                </div>
              </div>
            </div>

            {/* Step 2 — Decorator */}
            <div data-reveal className="text-center" style={{ transitionDelay: '150ms' }}>
              <div className="flex justify-center mb-8">
                <div
                  className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
                  style={{
                    background: 'rgba(124,58,237,0.1)',
                    border: '2px solid rgba(124,58,237,0.3)',
                    animation: 'stepPulse 3s 1s ease-in-out infinite',
                  }}
                >
                  <span className="text-2xl font-black" style={{
                    background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}>02</span>
                </div>
              </div>

              <h3 className="text-xl font-bold mb-3" style={{ color: '#fff' }}>Add one decorator</h3>
              <p className="text-sm leading-relaxed mb-6 max-w-xs mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {`@shield(agent='my-agent') — that's it. Costs, sessions, and guardrails are now tracked.`}
              </p>

              {/* Code snippet */}
              <div className="rounded-xl overflow-hidden max-w-xs mx-auto" style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div className="px-4 py-3 font-mono text-xs text-left">
                  <div><span style={{ color: '#a78bfa' }}>@shield</span><span style={{ color: 'rgba(255,255,255,0.6)' }}>(</span><span style={{ color: '#86efac' }}>agent=&apos;my-agent&apos;</span><span style={{ color: 'rgba(255,255,255,0.6)' }}>)</span></div>
                  <div><span style={{ color: '#67e8f9' }}>async def</span> <span style={{ color: 'rgba(255,255,255,0.7)' }}>research</span><span style={{ color: 'rgba(255,255,255,0.4)' }}>(query):</span></div>
                  <div><span style={{ color: 'rgba(255,255,255,0.25)' }}>    ...</span></div>
                </div>
              </div>
            </div>

            {/* Step 3 — Dashboard */}
            <div data-reveal className="text-center" style={{ transitionDelay: '300ms' }}>
              <div className="flex justify-center mb-8">
                <div
                  className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
                  style={{
                    background: 'rgba(124,58,237,0.1)',
                    border: '2px solid rgba(124,58,237,0.3)',
                    animation: 'stepPulse 3s 2s ease-in-out infinite',
                  }}
                >
                  <span className="text-2xl font-black" style={{
                    background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}>03</span>
                </div>
              </div>

              <h3 className="text-xl font-bold mb-3" style={{ color: '#fff' }}>See everything</h3>
              <p className="text-sm leading-relaxed mb-6 max-w-xs mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Open your dashboard. Costs in real-time. Sessions you can replay. Violations you can prevent.
              </p>

              {/* Mini dashboard */}
              <div className="rounded-xl overflow-hidden max-w-xs mx-auto" style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>today&apos;s spend</span>
                    <span className="text-sm font-bold font-mono" style={{ color: '#4ade80', animation: 'dashPulse 2s ease-in-out infinite' }}>$12.47</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>sessions</span>
                    <span className="text-sm font-bold font-mono" style={{ color: '#a78bfa', animation: 'dashPulse 2s 0.5s ease-in-out infinite' }}>1,247</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>violations</span>
                    <span className="text-sm font-bold font-mono" style={{ color: '#f59e0b', animation: 'dashPulse 2s 1s ease-in-out infinite' }}>0</span>
                  </div>
                  <div className="flex items-end gap-1 h-8 mt-1">
                    {[30, 50, 40, 70, 55, 80, 65, 75, 90, 60].map((h, j) => (
                      <div key={j} className="flex-1 rounded-t-sm" style={{
                        height: `${h}%`,
                        background: `linear-gradient(180deg, rgba(124,58,237,0.5), rgba(124,58,237,0.1))`,
                        animation: `barBounce 2.4s ${j * 0.15}s ease-in-out infinite alternate`,
                      }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

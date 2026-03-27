const STEPS = [
  {
    num: '01',
    title: 'Install the SDK',
    desc: 'One line. pip install agentshield. Works with OpenAI, Anthropic, Google, LangChain, CrewAI, and more.',
    code: 'pip install agentshield',
  },
  {
    num: '02',
    title: 'Add one decorator',
    desc: '@shield(agent=\'my-agent\') — that\'s it. Costs, sessions, and guardrails are now tracked.',
    code: "@shield(agent='my-agent')",
  },
  {
    num: '03',
    title: 'See everything',
    desc: 'Open your dashboard. Costs in real-time. Sessions you can replay. Violations you can prevent.',
    code: 'app.agentshield.one',
  },
]

export default function HowItWorks() {
  return (
    <section className="py-20 px-8" id="how-it-works">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-14 reveal">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: '#fff' }}>
            Up and running in 2 minutes.
          </h2>
          <p className="text-base max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>
            No infrastructure. No config files. No code changes to existing agents.
          </p>
        </div>

        <div className="relative">
          {/* Connecting line */}
          <div
            className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 hidden lg:block"
            style={{ background: 'linear-gradient(180deg, transparent, rgba(124,58,237,0.3) 20%, rgba(124,58,237,0.3) 80%, transparent)' }}
          />

          <div className="space-y-12 lg:space-y-0">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className={`reveal flex flex-col lg:flex-row items-center gap-8 lg:gap-16 ${i % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}
                style={{ animationDelay: `${i * 150}ms` }}
              >
                {/* Content */}
                <div className="flex-1 text-center lg:text-left">
                  <div
                    className="inline-block text-5xl font-black mb-4 leading-none"
                    style={{
                      background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      opacity: 0.4,
                    }}
                  >
                    {step.num}
                  </div>
                  <h3 className="text-xl font-bold mb-3" style={{ color: '#fff' }}>{step.title}</h3>
                  <p className="text-sm leading-relaxed max-w-sm mx-auto lg:mx-0" style={{ color: 'rgba(255,255,255,0.5)' }}>{step.desc}</p>
                </div>

                {/* Step node (center) */}
                <div className="relative flex-shrink-0 hidden lg:flex items-center justify-center w-12 h-12">
                  <div
                    className="w-4 h-4 rounded-full z-10"
                    style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', boxShadow: '0 0 20px rgba(124,58,237,0.5)' }}
                  />
                </div>

                {/* Code block */}
                <div className="flex-1 flex justify-center lg:justify-start">
                  <div
                    className="rounded-xl px-6 py-4 font-mono text-sm w-full max-w-xs"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#a78bfa',
                    }}
                  >
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>$ </span>
                    {step.code}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

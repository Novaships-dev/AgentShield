import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

const INTEGRATIONS: Record<string, {
  name: string
  description: string
  color: string
  useCase: string
  codeExample: string
}> = {
  langchain: {
    name: 'LangChain',
    description: 'Monitor LangChain agents with full cost tracking, session replay, and guardrails. One line of code.',
    color: '#1c86ee',
    useCase: 'LangChain chains, agents, and tools instrumentation',
    codeExample: `import agentshield
from langchain.agents import AgentExecutor

shield = agentshield.init(api_key="your-key")

# Wrap your existing LangChain agent
with shield.session(agent_id="my-langchain-agent") as session:
    result = agent_executor.invoke({"input": user_input})
    session.track_langchain(result)`,
  },
  openai: {
    name: 'OpenAI',
    description: 'Track OpenAI API costs per call, monitor token usage, detect anomalies on your GPT-4 and GPT-3.5 agents.',
    color: '#10a37f',
    useCase: 'OpenAI Assistants API, Chat Completions, and function calling',
    codeExample: `import agentshield
from openai import OpenAI

shield = agentshield.init(api_key="your-key")
client = shield.wrap_openai(OpenAI())

# All calls now tracked automatically
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": prompt}]
)`,
  },
  crewai: {
    name: 'CrewAI',
    description: 'Full observability for CrewAI multi-agent workflows. Track costs per agent, replay crew sessions, enforce guardrails.',
    color: '#ef4444',
    useCase: 'CrewAI crews, agents, and task orchestration',
    codeExample: `import agentshield
from crewai import Crew, Agent, Task

shield = agentshield.init(api_key="your-key")

with shield.session(agent_id="my-crew") as session:
    crew = Crew(agents=[agent1, agent2], tasks=[task1])
    result = crew.kickoff()
    session.track(result=result)`,
  },
  anthropic: {
    name: 'Anthropic',
    description: 'Monitor Claude API usage, track costs per session, detect prompt injection attempts on your Anthropic-powered agents.',
    color: '#d97706',
    useCase: 'Claude API, Claude Sonnet, Haiku and Opus monitoring',
    codeExample: `import agentshield
import anthropic

shield = agentshield.init(api_key="your-key")
client = shield.wrap_anthropic(anthropic.Anthropic())

# All Claude calls now tracked
message = client.messages.create(
    model="claude-opus-4-5",
    max_tokens=1024,
    messages=[{"role": "user", "content": prompt}]
)`,
  },
  llamaindex: {
    name: 'LlamaIndex',
    description: 'Instrument LlamaIndex RAG pipelines and agents. Track retrieval costs, monitor query latency, protect with PII redaction.',
    color: '#7c3aed',
    useCase: 'LlamaIndex query engines, agents, and RAG pipelines',
    codeExample: `import agentshield
from llama_index.core import VectorStoreIndex

shield = agentshield.init(api_key="your-key")

with shield.session(agent_id="rag-pipeline") as session:
    index = VectorStoreIndex.from_documents(docs)
    query_engine = index.as_query_engine()
    response = query_engine.query(user_query)
    session.track(response=str(response))`,
  },
  autogen: {
    name: 'AutoGen',
    description: 'Monitor AutoGen multi-agent conversations. Track token costs per agent, replay conversations, set budget caps.',
    color: '#06b6d4',
    useCase: 'AutoGen ConversableAgent and GroupChat monitoring',
    codeExample: `import agentshield
from autogen import AssistantAgent, UserProxyAgent

shield = agentshield.init(api_key="your-key")

with shield.session(agent_id="autogen-crew") as session:
    assistant = AssistantAgent("assistant", llm_config=llm_config)
    user_proxy = UserProxyAgent("user_proxy")
    user_proxy.initiate_chat(assistant, message=task)
    session.track(messages=assistant.chat_messages)`,
  },
  n8n: {
    name: 'n8n',
    description: 'Monitor what your n8n AI workflows cost per run. No code needed — just add one HTTP Request node after your AI call.',
    color: '#EA4B71',
    useCase: 'n8n workflows using OpenAI, Anthropic, or any LLM API node',
    codeExample: `// Step 1: Add an HTTP Request node after your AI node
// Step 2: Configure it exactly like this:

Method: POST
URL: https://api.agentshield.one/v1/track

Headers:
  Authorization: Bearer ags_live_xxxxx
  Content-Type: application/json

Body (JSON):
{
  "agent": "my-n8n-workflow",
  "model": "gpt-4o",
  "input_tokens": {{ $json.usage.prompt_tokens }},
  "output_tokens": {{ $json.usage.completion_tokens }}
}

// That's it. Costs appear in your dashboard in real time.
// No SDK. No code changes to your existing workflow.`,
  },
  make: {
    name: 'Make',
    description: 'Track what your Make scenarios spend on AI APIs. Setup in 2 minutes with the HTTP module — no code, no SDK.',
    color: '#6D00CC',
    useCase: 'Make (Integromat) scenarios using OpenAI, Anthropic, or any AI module',
    codeExample: `// Step 1: Add an HTTP module after your AI module
// Step 2: Configure it exactly like this:

Module: HTTP > Make a request
URL: https://api.agentshield.one/v1/track
Method: POST

Headers:
  Authorization: Bearer ags_live_xxxxx
  Content-Type: application/json

Body type: Raw
Content type: JSON (application/json)

Body:
{
  "agent": "my-make-scenario",
  "model": "gpt-4o",
  "input_tokens": {{ai_module.usage.prompt_tokens}},
  "output_tokens": {{ai_module.usage.completion_tokens}}
}

// Costs appear in your dashboard immediately.`,
  },
  zapier: {
    name: 'Zapier',
    description: 'See what your Zapier AI actions actually cost per run. Add a Webhooks step — no code required.',
    color: '#FF4A00',
    useCase: 'Zapier Zaps using OpenAI, Anthropic, or any AI action',
    codeExample: `// Step 1: Add a Webhooks by Zapier step after your AI action
// Step 2: Configure it exactly like this:

Action event: POST
URL: https://api.agentshield.one/v1/track

Headers:
  Authorization: Bearer ags_live_xxxxx

Payload type: JSON

Data:
  agent: my-zapier-zap
  model: gpt-4o
  input_tokens: {{ai_step.usage.prompt_tokens}}
  output_tokens: {{ai_step.usage.completion_tokens}}

// No SDK. No code. Costs tracked per Zap run.`,
  },
  flowise: {
    name: 'Flowise',
    description: 'Track what your Flowise chatflows cost per conversation. API integration, no proxy needed.',
    color: '#2B6CB0',
    useCase: 'Flowise chatflows and agent flows with any LLM node',
    codeExample: `// Option 1: Use the Flowise Custom Tool node
// Add an HTTP Request tool that POSTs to AgentShield

// Option 2: Track from your backend after calling Flowise API
const response = await fetch('https://your-flowise/api/v1/prediction/...', {
  method: 'POST',
  body: JSON.stringify({ question: userInput })
})
const result = await response.json()

// Then track to AgentShield:
await fetch('https://api.agentshield.one/v1/track', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ags_live_xxxxx',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    agent: 'my-flowise-chatflow',
    model: result.model || 'gpt-4o',
    input_tokens: result.tokenUsage?.promptTokens,
    output_tokens: result.tokenUsage?.completionTokens
  })
})`,
  },
  javascript: {
    name: 'JavaScript',
    description: 'Monitor LLM costs in your JavaScript or Node.js app with a single fetch() call. No SDK, no proxy, no setup.',
    color: '#F7DF1E',
    useCase: 'Node.js, Deno, Bun, Vercel AI SDK, and any browser/server JS environment',
    codeExample: `// Works with any JS environment — Node.js, Deno, Bun, Vercel Edge

async function trackAgentCall(agentName, model, usage) {
  await fetch('https://api.agentshield.one/v1/track', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ags_live_xxxxx',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      agent: agentName,
      model: model,
      input_tokens: usage.prompt_tokens,
      output_tokens: usage.completion_tokens
    })
  })
}

// Example with OpenAI SDK:
const completion = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: prompt }]
})

await trackAgentCall('my-agent', 'gpt-4o', completion.usage)
// Per-agent costs now visible in your dashboard.`,
  },
}

export function generateStaticParams() {
  return Object.keys(INTEGRATIONS).map(framework => ({ framework }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ framework: string }>
}): Promise<Metadata> {
  const { framework } = await params
  const integration = INTEGRATIONS[framework]
  if (!integration) return { title: 'Not Found' }
  return {
    title: `AgentShield for ${integration.name} — AI Agent Monitoring`,
    description: integration.description,
    alternates: { canonical: `https://agentshield.one/integrations/${framework}` },
  }
}

export default async function IntegrationPage({
  params,
}: {
  params: Promise<{ framework: string }>
}) {
  const { framework } = await params
  const integration = INTEGRATIONS[framework]
  if (!integration) notFound()

  return (
    <main style={{ background: '#030014', minHeight: '100vh', padding: '96px 20px 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href="/" style={{ color: '#4a3d6b', fontSize: 14, textDecoration: 'none', display: 'inline-block', marginBottom: 32 }}>
          ← AgentShield
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: integration.color, boxShadow: `0 0 8px ${integration.color}`, display: 'inline-block' }} />
          <span style={{ color: integration.color, fontWeight: 600, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Integration
          </span>
        </div>

        <h1 style={{ color: '#e2d9f3', fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 700, margin: '0 0 16px', letterSpacing: '-1px', lineHeight: 1.2 }}>
          AgentShield for {integration.name}
        </h1>
        <p style={{ color: '#9d8ec4', fontSize: 17, lineHeight: 1.7, marginBottom: 40 }}>
          {integration.description}
        </p>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '24px 28px', marginBottom: 40 }}>
          <p style={{ color: '#a78bfa', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
            Use case
          </p>
          <p style={{ color: '#9d8ec4', fontSize: 15, margin: 0 }}>{integration.useCase}</p>
        </div>

        <h2 style={{ color: '#e2d9f3', fontSize: 20, fontWeight: 700, margin: '0 0 16px' }}>
          Quick setup
        </h2>
        <pre style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '20px 24px', overflowX: 'auto', marginBottom: 40 }}>
          <code style={{ color: '#a78bfa', fontSize: 13, fontFamily: 'var(--font-jetbrains-mono), monospace', lineHeight: 1.7 }}>
            {integration.codeExample}
          </code>
        </pre>

        <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 14, padding: '28px 32px', textAlign: 'center' }}>
          <p style={{ color: '#e2d9f3', fontWeight: 700, fontSize: 18, margin: '0 0 8px' }}>
            Start monitoring your {integration.name} agents
          </p>
          <p style={{ color: '#9d8ec4', fontSize: 15, margin: '0 0 20px' }}>Free plan. No credit card required.</p>
          <a href="https://app.agentshield.one/setup" style={{ display: 'inline-block', background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', color: '#fff', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontWeight: 600, fontSize: 15 }}>
            Start Free →
          </a>
        </div>
      </div>
    </main>
  )
}

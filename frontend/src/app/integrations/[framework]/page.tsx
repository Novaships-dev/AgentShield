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

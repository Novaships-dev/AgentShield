function Code({ children }: { children: string }) {
  return (
    <pre
      className="rounded-xl p-4 text-xs font-mono overflow-x-auto my-4"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: '#a78bfa',
        lineHeight: '1.8',
      }}
    >
      <code>{children}</code>
    </pre>
  )
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-bold mt-10 mb-4 scroll-mt-20" style={{ color: '#fff' }}>
      {children}
    </h2>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
      {children}
    </p>
  )
}

export const metadata = {
  title: 'Framework Integrations — AgentShield Docs',
  description: 'AgentShield integrations for LangChain, CrewAI, AutoGen, and LlamaIndex.',
}

export default function FrameworksPage() {
  return (
    <div>
      <div className="mb-8">
        <span
          className="text-xs font-bold tracking-widest px-2 py-1 rounded-md"
          style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}
        >
          FRAMEWORKS
        </span>
        <h1 className="text-3xl font-bold mt-4 mb-2" style={{ color: '#fff' }}>Framework Integrations</h1>
        <P>
          AgentShield integrates natively with the most popular AI agent frameworks.
          All integrations are non-blocking — they never slow down or break your agents.
        </P>
      </div>

      <H2 id="langchain">LangChain</H2>
      <Code>pip install agentshield langchain-core</Code>
      <Code>{`from agentshield.integrations.langchain import AgentShieldCallback
from langchain_openai import ChatOpenAI

callback = AgentShieldCallback(
    agent_name="my-langchain-agent",
    session_id="optional-session-id",
)

llm = ChatOpenAI(model="gpt-4o")
llm.invoke("Hello", config={"callbacks": [callback]})`}</Code>

      <H2 id="crewai">CrewAI</H2>
      <Code>pip install agentshield crewai</Code>
      <Code>{`from agentshield.integrations.crewai import AgentShieldCrewCallback
from crewai import Agent, Crew, Task

# Instantiating registers the listener automatically
callback = AgentShieldCrewCallback(agent_name="my-crew")

researcher = Agent(role="Researcher", goal="...", backstory="...")
task = Task(description="Research ...", agent=researcher)
crew = Crew(agents=[researcher], tasks=[task])
crew.kickoff()`}</Code>

      <H2 id="autogen">AutoGen</H2>
      <Code>pip install agentshield pyautogen</Code>
      <Code>{`from agentshield.integrations.autogen import AgentShieldAutoGenHook
from autogen import AssistantAgent, UserProxyAgent

hook = AgentShieldAutoGenHook(agent_name="my-autogen-agent")

assistant = AssistantAgent("assistant", llm_config={"model": "gpt-4o"})
hook.register(assistant)  # attach hooks

user = UserProxyAgent("user", human_input_mode="NEVER")
user.initiate_chat(assistant, message="Research AI safety.")`}</Code>

      <H2 id="llamaindex">LlamaIndex</H2>
      <Code>pip install agentshield llama-index-core</Code>
      <Code>{`from agentshield.integrations.llamaindex import AgentShieldLlamaIndexCallback
from llama_index.core import Settings
from llama_index.core.callbacks import CallbackManager

callback = AgentShieldLlamaIndexCallback(agent_name="my-llama-agent")
Settings.callback_manager = CallbackManager([callback])

# All LLM calls via LlamaIndex are now tracked
from llama_index.core import VectorStoreIndex
index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine()
response = query_engine.query("What is AgentShield?")`}</Code>

      <H2 id="direct">Direct API / Any framework</H2>
      <P>No framework? Use the decorator directly on any Python function that calls an LLM:</P>
      <Code>{`from agentshield import shield

@shield(agent="my-agent")
async def call_llm(prompt: str) -> str:
    # Your existing LLM call
    response = await openai.chat.completions.create(...)
    return response.choices[0].message.content`}</Code>
    </div>
  )
}

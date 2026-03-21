# FRAMEWORKS.md — Intégrations Frameworks AgentShield

> Ce fichier définit comment AgentShield s'intègre avec les frameworks IA populaires : LangChain, CrewAI, AutoGen, LlamaIndex. Claude Code le lit avant de coder un callback d'intégration.
> Cohérent avec : SDK.md (architecture SDK), REPLAY.md (sessions/steps), API.md (POST /v1/track)
> Dernière mise à jour : mars 2026

---

## 1. PRINCIPE

AgentShield est **framework-agnostic**. Le décorateur `@shield()` fonctionne avec n'importe quel code Python. Mais les frameworks IA ont leurs propres systèmes de callbacks qui permettent une intégration plus profonde et automatique.

```
@shield() (décorateur)
  → Le dev wrap manuellement ses fonctions
  → Contrôle total sur ce qui est capturé
  → Fonctionne avec tout

Callbacks (intégrations)
  → S'injectent dans le framework automatiquement
  → Capturent TOUS les appels LLM sans modifier le code
  → Gèrent les sessions/steps automatiquement
  → Spécifiques à chaque framework
```

**L'objectif : le dev ajoute UNE ligne et TOUT est capturé.**

---

## 2. ARCHITECTURE COMMUNE

### BaseCallback

```python
# sdk/agentshield/integrations/base.py

from agentshield.client import get_client
from agentshield.models import TrackEvent
from agentshield.pii import redact_pii
from contextvars import ContextVar
from uuid import uuid4
import time

_session_var: ContextVar[str | None] = ContextVar("ags_session", default=None)
_step_var: ContextVar[int] = ContextVar("ags_step", default=0)

class BaseCallback:
    """Base class for all framework integration callbacks."""

    def __init__(
        self,
        agent: str,
        api_key: str | None = None,
        session_id: str | None = None,
        auto_session: bool = True,
        workflow: str | None = None,
        team_label: str | None = None,
        metadata: dict | None = None,
    ):
        self._agent = agent
        self._api_key = api_key
        self._auto_session = auto_session
        self._workflow = workflow
        self._team_label = team_label
        self._metadata = metadata or {}
        self._client = get_client(api_key=api_key)

        # Session management
        if session_id:
            _session_var.set(session_id)
        elif auto_session:
            _session_var.set(f"auto_{uuid4().hex[:12]}")

    @property
    def session_id(self) -> str | None:
        return _session_var.get()

    def _next_step(self) -> int:
        """Increment and return the next step number."""
        current = _step_var.get()
        _step_var.set(current + 1)
        return current + 1

    def _track(
        self,
        step_name: str,
        model: str | None = None,
        provider: str | None = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
        cost_usd: float | None = None,
        input_text: str | None = None,
        output_text: str | None = None,
        status: str = "success",
        duration_ms: int | None = None,
        extra_metadata: dict | None = None,
    ):
        """Send a tracking event to AgentShield."""
        # PII redaction côté client
        if input_text:
            input_text, _ = redact_pii(input_text)
        if output_text:
            output_text, _ = redact_pii(output_text)

        merged_metadata = {**self._metadata, **(extra_metadata or {})}

        event = TrackEvent(
            agent=self._agent,
            session_id=self.session_id,
            step=self._next_step(),
            step_name=step_name,
            model=model,
            provider=provider,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
            input_text=input_text,
            output_text=output_text,
            status=status,
            duration_ms=duration_ms,
            workflow=self._workflow,
            team_label=self._team_label,
            metadata=merged_metadata,
        )

        # Envoi non-bloquant (fire and forget dans un thread)
        try:
            self._client.track(event)
        except Exception:
            pass  # Ne jamais bloquer le framework du dev
```

### Principes communs à TOUTES les intégrations

```
1. Ne JAMAIS bloquer le code du dev (fire and forget)
2. Ne JAMAIS modifier les réponses du LLM
3. Ne JAMAIS lever d'exception qui casse le framework
4. Capturer automatiquement : model, tokens, input, output, duration
5. Générer un session_id automatique si non fourni
6. Auto-incrémenter les steps
7. Appliquer la PII redaction côté client
8. Logger les erreurs AgentShield en debug, pas en warning/error
```

---

## 3. LANGCHAIN

### Installation

```python
# Aucune dépendance supplémentaire — le callback utilise les interfaces LangChain
from agentshield.integrations import LangChainCallback
```

### Usage basique

```python
from langchain_openai import ChatOpenAI
from agentshield.integrations import LangChainCallback

callback = LangChainCallback(agent="my-langchain-agent")

llm = ChatOpenAI(model="gpt-4o", callbacks=[callback])
result = llm.invoke("What is the capital of France?")

# Automatiquement capturé :
# - model: gpt-4o
# - input_text: "What is the capital of France?"
# - output_text: "The capital of France is Paris."
# - tokens, cost, duration
```

### Usage avec chain/agent

```python
from langchain.agents import create_openai_tools_agent, AgentExecutor
from langchain_openai import ChatOpenAI
from agentshield.integrations import LangChainCallback

callback = LangChainCallback(
    agent="support-agent",
    workflow="customer-support",
    team_label="backend",
)

llm = ChatOpenAI(model="gpt-4o", callbacks=[callback])
agent = create_openai_tools_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, callbacks=[callback])

# Chaque étape du chain est un step séparé :
# Step 1: LLM call (agent reasoning)
# Step 2: Tool call (search_database)
# Step 3: LLM call (final answer)
result = executor.invoke({"input": "Check my order status"})
```

### Implémentation callback

```python
# sdk/agentshield/integrations/langchain.py

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult
from typing import Any

class LangChainCallback(BaseCallback, BaseCallbackHandler):
    """LangChain callback handler for AgentShield."""

    def __init__(self, **kwargs):
        BaseCallback.__init__(self, **kwargs)
        BaseCallbackHandler.__init__(self)
        self._start_times: dict[str, float] = {}
        self._inputs: dict[str, str] = {}

    def on_llm_start(self, serialized: dict, prompts: list[str], *, run_id, **kwargs):
        """Called when an LLM call starts."""
        self._start_times[str(run_id)] = time.time()
        self._inputs[str(run_id)] = prompts[0] if prompts else ""

    def on_llm_end(self, response: LLMResult, *, run_id, **kwargs):
        """Called when an LLM call ends."""
        duration_ms = int((time.time() - self._start_times.pop(str(run_id), time.time())) * 1000)
        input_text = self._inputs.pop(str(run_id), "")

        generation = response.generations[0][0] if response.generations else None
        output_text = generation.text if generation else ""

        # Extraire les infos du LLM result
        llm_output = response.llm_output or {}
        token_usage = llm_output.get("token_usage", {})

        model = llm_output.get("model_name", kwargs.get("model", "unknown"))

        self._track(
            step_name="llm_call",
            model=model,
            input_tokens=token_usage.get("prompt_tokens", 0),
            output_tokens=token_usage.get("completion_tokens", 0),
            input_text=input_text,
            output_text=output_text,
            duration_ms=duration_ms,
            status="success",
        )

    def on_llm_error(self, error: Exception, *, run_id, **kwargs):
        """Called when an LLM call fails."""
        duration_ms = int((time.time() - self._start_times.pop(str(run_id), time.time())) * 1000)
        input_text = self._inputs.pop(str(run_id), "")

        self._track(
            step_name="llm_call",
            input_text=input_text,
            output_text=str(error)[:500],
            duration_ms=duration_ms,
            status="error",
            extra_metadata={"error_type": type(error).__name__},
        )

    def on_chain_start(self, serialized: dict, inputs: dict, *, run_id, **kwargs):
        """Called when a chain starts."""
        self._start_times[str(run_id)] = time.time()

    def on_chain_end(self, outputs: dict, *, run_id, **kwargs):
        """Called when a chain ends — used for session tracking."""
        pass  # La session se ferme naturellement (30min timeout)

    def on_tool_start(self, serialized: dict, input_str: str, *, run_id, **kwargs):
        """Called when a tool is invoked."""
        self._start_times[str(run_id)] = time.time()
        self._inputs[str(run_id)] = input_str

    def on_tool_end(self, output: str, *, run_id, **kwargs):
        """Called when a tool returns."""
        duration_ms = int((time.time() - self._start_times.pop(str(run_id), time.time())) * 1000)
        tool_name = kwargs.get("name", "tool_call")

        self._track(
            step_name=f"tool:{tool_name}",
            input_text=self._inputs.pop(str(run_id), ""),
            output_text=output[:5000] if output else "",
            duration_ms=duration_ms,
            status="success",
            extra_metadata={"type": "tool_call", "tool": tool_name},
        )
```

---

## 4. CREWAI

### Usage

```python
from crewai import Agent, Task, Crew
from agentshield.integrations import CrewAICallback

callback = CrewAICallback(agent="my-crew", workflow="content-creation")

# Chaque agent CrewAI = un step AgentShield
researcher = Agent(role="Researcher", ...)
writer = Agent(role="Writer", ...)

task1 = Task(description="Research topic", agent=researcher)
task2 = Task(description="Write article", agent=writer)

crew = Crew(
    agents=[researcher, writer],
    tasks=[task1, task2],
    callbacks=[callback],
)

result = crew.kickoff()

# Session auto-générée :
# Step 1: "Researcher" → LLM call + tool calls
# Step 2: "Writer" → LLM call
```

### Implémentation

```python
# sdk/agentshield/integrations/crewai.py

class CrewAICallback(BaseCallback):
    """CrewAI callback handler for AgentShield."""

    def on_agent_start(self, agent_name: str, task_description: str, **kwargs):
        """Called when a CrewAI agent starts working on a task."""
        self._current_agent = agent_name
        self._task_start = time.time()

    def on_agent_end(self, agent_name: str, output: str, **kwargs):
        """Called when a CrewAI agent completes a task."""
        duration_ms = int((time.time() - self._task_start) * 1000)

        self._track(
            step_name=f"agent:{agent_name}",
            output_text=output[:5000],
            duration_ms=duration_ms,
            status="success",
            extra_metadata={"crewai_agent": agent_name},
        )

    def on_task_start(self, task_description: str, **kwargs):
        """Called when a task begins."""
        pass  # Tracked via agent start/end

    def on_llm_call(self, model: str, prompt: str, response: str, tokens: dict, **kwargs):
        """Called for each LLM call within an agent."""
        self._track(
            step_name=f"llm:{self._current_agent}",
            model=model,
            input_tokens=tokens.get("input", 0),
            output_tokens=tokens.get("output", 0),
            input_text=prompt,
            output_text=response,
            status="success",
        )
```

---

## 5. AUTOGEN

### Usage

```python
from autogen import AssistantAgent, UserProxyAgent
from agentshield.integrations import AutoGenCallback

callback = AutoGenCallback(agent="my-autogen-group")

assistant = AssistantAgent("assistant", llm_config={...})
user_proxy = UserProxyAgent("user_proxy", ...)

# Chaque message entre agents = un step
user_proxy.initiate_chat(
    assistant,
    message="Write a Python function to sort a list",
    callbacks=[callback],
)

# Session auto :
# Step 1: user_proxy → assistant (message)
# Step 2: assistant → user_proxy (code generation)
# Step 3: user_proxy → assistant (execution result)
# Step 4: assistant → user_proxy (final response)
```

### Implémentation

```python
# sdk/agentshield/integrations/autogen.py

class AutoGenCallback(BaseCallback):
    """AutoGen callback handler for AgentShield."""

    def on_message_sent(self, sender: str, receiver: str, message: str, **kwargs):
        """Called when an agent sends a message."""
        self._track(
            step_name=f"msg:{sender}→{receiver}",
            input_text=message[:5000],
            status="success",
            extra_metadata={
                "type": "agent_message",
                "sender": sender,
                "receiver": receiver,
            },
        )

    def on_llm_call(self, agent_name: str, model: str, prompt: str, response: str, tokens: dict, duration_ms: int, **kwargs):
        """Called for each LLM call."""
        self._track(
            step_name=f"llm:{agent_name}",
            model=model,
            input_tokens=tokens.get("input", 0),
            output_tokens=tokens.get("output", 0),
            input_text=prompt,
            output_text=response,
            duration_ms=duration_ms,
            status="success",
        )

    def on_code_execution(self, agent_name: str, code: str, result: str, success: bool, **kwargs):
        """Called when code is executed."""
        self._track(
            step_name=f"code:{agent_name}",
            input_text=code[:5000],
            output_text=result[:5000],
            status="success" if success else "error",
            extra_metadata={"type": "code_execution"},
        )
```

---

## 6. LLAMAINDEX

### Usage

```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
from agentshield.integrations import LlamaIndexCallback

callback = LlamaIndexCallback(agent="my-rag-agent", workflow="document-qa")

# Chaque étape du RAG pipeline = un step
documents = SimpleDirectoryReader("data").load_data()
index = VectorStoreIndex.from_documents(documents, callbacks=[callback])
query_engine = index.as_query_engine(callbacks=[callback])

response = query_engine.query("What is the company's revenue?")

# Session auto :
# Step 1: "embed" → embedding call
# Step 2: "retrieve" → vector search
# Step 3: "synthesize" → LLM generation
```

### Implémentation

```python
# sdk/agentshield/integrations/llamaindex.py

from llama_index.core.callbacks import CallbackManager, CBEventType, EventPayload
from llama_index.core.callbacks.base_handler import BaseCallbackHandler as LIBaseHandler

class LlamaIndexCallback(BaseCallback, LIBaseHandler):
    """LlamaIndex callback handler for AgentShield."""

    def __init__(self, **kwargs):
        BaseCallback.__init__(self, **kwargs)
        LIBaseHandler.__init__(self, event_starts_to_trace=[], event_ends_to_trace=[])
        self._event_starts: dict[str, float] = {}

    def on_event_start(self, event_type: CBEventType, payload: dict | None = None, event_id: str = "", **kwargs):
        self._event_starts[event_id] = time.time()

    def on_event_end(self, event_type: CBEventType, payload: dict | None = None, event_id: str = "", **kwargs):
        duration_ms = int((time.time() - self._event_starts.pop(event_id, time.time())) * 1000)
        payload = payload or {}

        if event_type == CBEventType.LLM:
            self._track(
                step_name="llm_call",
                model=payload.get(EventPayload.SERIALIZED, {}).get("model", "unknown"),
                input_text=str(payload.get(EventPayload.PROMPT, ""))[:5000],
                output_text=str(payload.get(EventPayload.COMPLETION, ""))[:5000],
                input_tokens=payload.get("prompt_tokens", 0),
                output_tokens=payload.get("completion_tokens", 0),
                duration_ms=duration_ms,
            )
        elif event_type == CBEventType.RETRIEVE:
            nodes = payload.get(EventPayload.NODES, [])
            self._track(
                step_name="retrieve",
                output_text=f"Retrieved {len(nodes)} nodes",
                duration_ms=duration_ms,
                extra_metadata={"nodes_count": len(nodes)},
            )
        elif event_type == CBEventType.EMBEDDING:
            self._track(
                step_name="embed",
                duration_ms=duration_ms,
                extra_metadata={"type": "embedding"},
            )
        elif event_type == CBEventType.SYNTHESIZE:
            self._track(
                step_name="synthesize",
                output_text=str(payload.get(EventPayload.RESPONSE, ""))[:5000],
                duration_ms=duration_ms,
            )

    def start_trace(self, trace_id: str | None = None):
        if trace_id:
            _session_var.set(trace_id)

    def end_trace(self, trace_id: str | None = None, trace_map: dict | None = None):
        pass
```

---

## 7. AJOUT D'UNE NOUVELLE INTÉGRATION

### Checklist

```
□ Hériter de BaseCallback
□ Implémenter les hooks du framework cible
□ Capturer : model, tokens, input/output text, duration, status
□ Gérer les sessions (auto si non fourni)
□ Gérer les steps (auto-increment)
□ PII redaction via self._track() (hérité de BaseCallback)
□ Ne jamais bloquer le framework (try/except autour de self._track())
□ Ne jamais modifier les réponses du LLM
□ Ajouter les tests dans tests/test_integrations.py
□ Ajouter la doc dans SDK.md et FRAMEWORKS.md
□ Ajouter l'import dans sdk/agentshield/integrations/__init__.py
```

### Pattern de test

```python
# tests/test_integrations.py

def test_langchain_callback_captures_llm_call(mock_api):
    """LangChain callback sends tracking event on LLM call."""
    callback = LangChainCallback(agent="test")

    # Simuler un appel LLM
    callback.on_llm_start({"name": "ChatOpenAI"}, ["Hello"], run_id=uuid4())
    callback.on_llm_end(
        LLMResult(generations=[[Generation(text="Hi!")]], llm_output={"model_name": "gpt-4o", "token_usage": {"prompt_tokens": 5, "completion_tokens": 3}}),
        run_id=uuid4(),
    )

    # Vérifier que POST /v1/track a été appelé
    assert mock_api["POST /v1/track"].called
    payload = mock_api["POST /v1/track"].calls[0].request.content
    assert "gpt-4o" in payload
```

---

## 8. MATRICE DE COMPATIBILITÉ

| Framework | Version supportée | Callbacks capturés | Session auto | Steps auto |
|-----------|-------------------|-------------------|-------------|------------|
| LangChain | ≥ 0.2.0 | llm_start/end, chain, tool | ✅ | ✅ |
| CrewAI | ≥ 0.28.0 | agent_start/end, llm_call | ✅ | ✅ |
| AutoGen | ≥ 0.2.0 | message, llm_call, code_exec | ✅ | ✅ |
| LlamaIndex | ≥ 0.10.0 | llm, retrieve, embed, synthesize | ✅ | ✅ |
| Custom | Any | Via @shield() décorateur | Manual | Manual |

**Les intégrations frameworks sont optionnelles.** Le dev n'est PAS obligé de les utiliser. `@shield()` fonctionne avec tout.

---

> **Règle :** Les intégrations frameworks sont un accélérateur d'adoption. Plus c'est facile à intégrer, plus les devs adoptent.
> Le dev ajoute UNE ligne → TOUT est capturé. C'est la promesse. Chaque intégration doit la tenir.

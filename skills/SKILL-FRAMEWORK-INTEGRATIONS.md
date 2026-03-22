# SKILL-FRAMEWORK-INTEGRATIONS.md — Comment coder les intégrations frameworks

> Lire AVANT de coder un callback LangChain, CrewAI, AutoGen, ou LlamaIndex. Réfs : FRAMEWORKS.md, SDK.md (section 9)

---

## ARCHITECTURE

```
Tous les callbacks héritent de BaseCallback :

BaseCallback (sdk/agentshield/integrations/base.py)
├── LangChainCallback  (langchain.py)
├── CrewAICallback     (crewai.py)
├── AutoGenCallback    (autogen.py)
└── LlamaIndexCallback (llamaindex.py)

BaseCallback fournit :
  - self._agent (nom de l'agent AgentShield)
  - self._track(**event_data) → envoie POST /v1/track (fire and forget)
  - self._next_step() → auto-increment du step number
  - self.session_id → auto-généré ou fourni par le dev
  - PII redaction côté client (via self._track)
  - Thread safety (contextvars)
```

## PATTERN COMMUN

```python
class MyFrameworkCallback(BaseCallback, FrameworkBaseHandler):
    """AgentShield callback for MyFramework."""

    def __init__(self, agent: str, **kwargs):
        BaseCallback.__init__(self, agent=agent, **kwargs)
        FrameworkBaseHandler.__init__(self)
        self._start_times: dict[str, float] = {}
        self._inputs: dict[str, str] = {}

    def on_llm_start(self, ..., run_id, **kwargs):
        self._start_times[str(run_id)] = time.time()
        self._inputs[str(run_id)] = extract_input(...)

    def on_llm_end(self, response, ..., run_id, **kwargs):
        duration = int((time.time() - self._start_times.pop(str(run_id), time.time())) * 1000)
        self._track(
            step_name="llm_call",
            model=extract_model(response),
            input_tokens=extract_input_tokens(response),
            output_tokens=extract_output_tokens(response),
            input_text=self._inputs.pop(str(run_id), ""),
            output_text=extract_output_text(response),
            duration_ms=duration,
            status="success",
        )

    def on_llm_error(self, error, ..., run_id, **kwargs):
        duration = int((time.time() - self._start_times.pop(str(run_id), time.time())) * 1000)
        self._track(
            step_name="llm_call",
            input_text=self._inputs.pop(str(run_id), ""),
            output_text=str(error)[:500],
            duration_ms=duration,
            status="error",
        )
```

## CE QUE CHAQUE CALLBACK CAPTURE

```
LangChain :
  on_llm_start/end     → LLM calls (model, tokens, input, output)
  on_tool_start/end    → Tool calls (name, input, output)
  on_chain_start/end   → Chain tracking (session boundary)

CrewAI :
  on_agent_start/end   → Agent execution (par agent CrewAI)
  on_llm_call          → LLM calls within an agent
  on_task_start/end    → Task tracking

AutoGen :
  on_message_sent      → Messages between agents
  on_llm_call          → LLM calls
  on_code_execution    → Code execution results

LlamaIndex :
  LLM event           → LLM calls
  RETRIEVE event      → Vector search (nodes count)
  EMBEDDING event     → Embedding calls
  SYNTHESIZE event    → Response synthesis
```

## SESSION MANAGEMENT

```python
# Auto-session : chaque callback génère un session_id unique
# Le dev peut override : LangChainCallback(agent="x", session_id="my-session")

# LangChain : 1 chain execution = 1 session
# CrewAI : 1 crew.kickoff() = 1 session
# AutoGen : 1 initiate_chat() = 1 session
# LlamaIndex : 1 query() = 1 session
```

## EXTRACTION PAR FRAMEWORK

```python
# LangChain
def extract_from_langchain(response: LLMResult) -> dict:
    llm_output = response.llm_output or {}
    token_usage = llm_output.get("token_usage", {})
    return {
        "model": llm_output.get("model_name", "unknown"),
        "input_tokens": token_usage.get("prompt_tokens", 0),
        "output_tokens": token_usage.get("completion_tokens", 0),
        "output_text": response.generations[0][0].text if response.generations else "",
    }

# CrewAI
# Accès via les kwargs du callback — dépend de la version CrewAI

# AutoGen
# Accès via les arguments on_llm_call(model, prompt, response, tokens)

# LlamaIndex
# Accès via le payload dict avec EventPayload keys
```

## TESTS

```python
# tests/test_integrations.py

# Simuler les callbacks du framework sans importer le framework entier
# Vérifier que self._track() est appelé avec les bonnes données
# Vérifier que le session_id est auto-généré
# Vérifier que les steps s'auto-incrémentent
# Vérifier que les erreurs du framework sont capturées (status="error")
# Vérifier que self._track() ne lève JAMAIS d'exception (fire and forget)

def test_langchain_callback_captures_llm(mock_api):
    cb = LangChainCallback(agent="test")
    cb.on_llm_start({"name": "ChatOpenAI"}, ["Hello"], run_id=uuid4())
    cb.on_llm_end(mock_llm_result, run_id=uuid4())
    assert mock_api["POST /v1/track"].called

def test_callback_never_raises(mock_api):
    mock_api.post("/v1/track").respond(500)
    cb = LangChainCallback(agent="test")
    # Ceci ne doit PAS lever d'exception
    cb.on_llm_start({}, ["test"], run_id=uuid4())
    cb.on_llm_end(mock_result, run_id=uuid4())
```

## AJOUT D'UN NOUVEAU FRAMEWORK

```
1. Créer sdk/agentshield/integrations/{framework}.py
2. Hériter de BaseCallback + le handler du framework
3. Implémenter les hooks (on_llm_start/end minimum)
4. Capturer : model, tokens, input/output text, duration, status
5. Gérer les sessions (auto si non fourni)
6. try/except autour de CHAQUE self._track() call
7. Ajouter l'import dans integrations/__init__.py
8. Ajouter les tests dans test_integrations.py
9. Documenter dans FRAMEWORKS.md + SDK.md
10. Ajouter dans la matrice de compatibilité
```

## RÈGLES

```
1. Ne JAMAIS bloquer le framework du dev (fire and forget)
2. Ne JAMAIS modifier les réponses du LLM
3. Ne JAMAIS lever d'exception qui casse le framework
4. try/except autour de chaque self._track()
5. Les frameworks ne sont PAS des dépendances du SDK (import optionnel)
6. Les callbacks sont testables sans installer le framework
7. Session auto-générée si non fournie
8. Steps auto-incrémentés
9. PII redaction via BaseCallback._track() (automatique)
10. Chaque callback a sa propre doc dans FRAMEWORKS.md
```

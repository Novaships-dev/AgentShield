# SKILL-SLACK-BOT.md — Comment coder le Slack bot AgentShield

> Lire AVANT de toucher à l'intégration Slack (bot, slash commands, OAuth). Réfs : INTEGRATIONS.md (section 6), SPEC.md (section 21), WEBHOOKS.md (section 3)

---

## DEUX USAGES DISTINCTS

```
1. Alertes simples (Starter+)
   → Incoming webhook URL configurée par le user dans alert rules
   → POST vers webhook_url avec Block Kit payload
   → Pas d'OAuth, pas de bot, juste un webhook

2. Bot interactif (Team plan)
   → Slack App avec OAuth
   → Slash commands : /shield status, /shield agent X, etc.
   → Installé dans le workspace du client
   → Nécessite : commands, chat:write scopes
```

## SLACK APP SETUP

```
1. Créer l'app sur api.slack.com/apps
2. OAuth scopes : commands, chat:write, incoming-webhook
3. Slash command : /shield → POST https://api.agentshield.one/v1/slack/commands
4. Events URL : https://api.agentshield.one/v1/slack/events
5. Redirect URL : https://app.agentshield.one/api/slack/callback
```

## OAUTH FLOW

```python
# 1. User clique "Connect Slack" → redirect vers Slack OAuth
authorize_url = f"https://slack.com/oauth/v2/authorize?client_id={SLACK_CLIENT_ID}&scope=commands,chat:write&redirect_uri={REDIRECT_URI}&state={org_id}"

# 2. Slack redirige vers notre callback avec un code
@router.get("/api/slack/callback")
async def slack_callback(code: str, state: str):
    response = httpx.post("https://slack.com/api/oauth.v2.access", data={
        "client_id": SLACK_CLIENT_ID,
        "client_secret": SLACK_CLIENT_SECRET,
        "code": code,
    })
    data = response.json()
    # Stocker : data["access_token"], data["team"]["id"], data["incoming_webhook"]
    # Chiffrer le token avant stockage (ENCRYPTION_KEY)
```

## SLASH COMMANDS

```python
@router.post("/v1/slack/commands")
async def handle_command(request: Request):
    form = await request.form()
    verify_slack_signature(request)  # OBLIGATOIRE

    command = form["command"]  # "/shield"
    text = form["text"]        # "status" ou "agent support-agent"
    team_id = form["team_id"]

    org = await get_org_by_slack_team(team_id)
    if not org or org["plan"] != "team":
        return {"response_type": "ephemeral", "text": "AgentShield bot requires the Team plan."}

    subcommand, args = parse_command(text)
    handler = COMMAND_HANDLERS.get(subcommand, cmd_help)
    return await handler(org, args)
```

## BLOCK KIT RESPONSES

```python
# Les réponses sont en Block Kit (pas du texte brut)
# response_type: "ephemeral" (seul l'user voit)
# Toujours inclure un bouton "Open Dashboard"

def slack_response(blocks: list, ephemeral: bool = True) -> dict:
    return {
        "response_type": "ephemeral" if ephemeral else "in_channel",
        "blocks": blocks,
    }
```

## SIGNATURE VERIFICATION

```python
# OBLIGATOIRE sur chaque requête Slack
# Vérifier X-Slack-Signature + X-Slack-Request-Timestamp
# Rejeter si timestamp > 5 minutes (replay attack)
# Utiliser hmac.compare_digest (constant-time)
```

## RÈGLES

```
1. Vérifier la signature Slack sur CHAQUE requête (slash commands + events)
2. Répondre en < 3 secondes (sinon Slack timeout → ack immédiat + follow-up)
3. Réponses ephemeral (seul l'user voit) — pas de spam dans le channel
4. Le bot est READ-ONLY — il ne modifie RIEN dans AgentShield
5. Le Slack token est chiffré en DB (ENCRYPTION_KEY)
6. Rate limit : 1 commande par user par 10 secondes
7. Max 1 workspace Slack par org
```

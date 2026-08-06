# Pivot Architetturale: Stregatto V3 — Piano Definitivo

> **TL;DR**: La Canvas UI e Claude Code si incastrano quasi perfettamente. Non serve PTY — Claude Code ha un mode headless con output JSON strutturato. Il backend diventa un traduttore di ~200 righe tra due protocolli quasi identici.

---

## Scoperte dalla Ricerca

### Canvas UI — Già Pronta al 90%
La Canvas UI (`plugins/canvas_ui/public`) è una SPA **vanilla JS senza build step** (HTML + JS modules + Tailwind CDN). Il suo protocollo di chat è basato su **SSE (Server-Sent Events)**, non WebSocket:

| File | Ruolo | Dimensione |
|------|-------|-----------|
| `view_chat.js` | Chat core: SSE streaming, tool rendering, artifact cards, timeline | 61KB |
| `api.js` | REST client + SSE helper, auth headers | 8KB |
| `cat_client.js` | WebSocket (solo per MCP events, non per chat) | 3KB |
| `router.js` | SPA hash router con auth guards | 9KB |
| `auth.js` | Supabase auth (config da `/canvas/config`) | 2KB |
| `themes.css` | Design system Neo-Brutalist | 4KB |

**Protocollo SSE della Chat** (quello che il frontend si aspetta):
```
POST /agents/{slug}/message  →  Body: { "messages": [...], "stream": true }

Eventi SSE ricevuti:
  TEXT_MESSAGE_CONTENT  { "delta": "chunk di testo" }
  TOOL_CALL_START       { "tool_call_id": "tc_123", "tool_call_name": "Bash" }
  TOOL_CALL_ARGS        { "tool_call_id": "tc_123", "delta": "chunk json args" }
  TOOL_CALL_END         { "tool_call_id": "tc_123" }
  RUN_FINISHED          { "result": { "output": "..." } }
  RUN_ERROR             { "message": "..." }
```

### Claude Code CLI — Non Serve PTY!

> [!TIP]
> **Scoperta cruciale**: Claude Code ha un mode **non-interattivo** (`-p` / `--print`) con output JSON strutturato (`--output-format stream-json`). Non richiede TTY, non serve PTY. Gira come un semplice subprocess.

```bash
# Comando base
claude -p "il prompt dell'utente" \
  --output-format stream-json \
  --verbose \
  --dangerously-skip-permissions

# Multi-turn: continua l'ultima sessione
claude -p "follow-up" --output-format stream-json --continue

# Riprendi sessione specifica
claude -p "altro messaggio" --output-format stream-json --resume "session-uuid"
```

**Formato Output (NDJSON — una riga JSON per evento):**

| Evento Claude Code | Contenuto |
|---|---|
| `system` (subtype: `init`) | `{ session_id, model, cwd, tools }` |
| `assistant` | `{ message: { content: [{ type: "text", text }, { type: "tool_use", id, name, input }] } }` |
| `tool_progress` | `{ tool: "Bash", status: "running" }` |
| `user` | `{ message: { content: [{ type: "tool_result", tool_use_id, content }] } }` |
| `result` (subtype: `success`) | `{ result: "testo finale", duration_ms, total_cost, usage }` |

### OpenRouter — Supporto Nativo
```bash
export ANTHROPIC_BASE_URL="https://openrouter.ai/api"
export ANTHROPIC_AUTH_TOKEN="sk-or-v1-..."
export ANTHROPIC_API_KEY=""  # vuoto per disabilitare fallback diretto Anthropic
```

---

## Il Bridge: 200 Righe di Colla

Il cuore del nuovo backend è un **traduttore** tra due protocolli quasi identici:

```
┌──────────────┐     SSE      ┌──────────────┐   subprocess   ┌──────────────┐
│  Canvas UI   │ ◄──────────► │   FastAPI     │ ◄────────────► │  claude CLI  │
│  (browser)   │  (events UI) │   Bridge      │   (NDJSON)     │  (headless)  │
└──────────────┘              └──────────────┘                 └──────────────┘
```

### Tabella di Traduzione Eventi

| Claude Code NDJSON → | → Canvas UI SSE |
|---|---|
| `{ type: "system", subtype: "init" }` | *(ignora o logga)* |
| `{ type: "assistant", message.content: [{ type: "text", text: "..." }] }` | `TEXT_MESSAGE_CONTENT { delta: "..." }` |
| `{ type: "assistant", message.content: [{ type: "tool_use", id, name, input }] }` | `TOOL_CALL_START { tool_call_id, tool_call_name }` → `TOOL_CALL_ARGS { delta: JSON.stringify(input) }` → `TOOL_CALL_END { tool_call_id }` |
| `{ type: "tool_progress", tool, status }` | *(opzionale: mostrato come TOOL_CALL_ARGS update)* |
| `{ type: "user", message.content: [{ type: "tool_result" }] }` | *(usato internamente per i tool results, non esposto alla UI — oppure esposto come un nuovo tipo SSE custom "TOOL_RESULT")* |
| `{ type: "result", subtype: "success" }` | `RUN_FINISHED { result: { output: "..." } }` |
| `{ type: "result", subtype: "error" }` | `RUN_ERROR { message: "..." }` |

> [!NOTE]
> **Streaming testuale**: Claude Code in `stream-json` emette gli eventi `assistant` come turni completi (non token-by-token). Il testo arriva tutto insieme a fine turno. Per mantenere il "typewriter effect" possiamo:
> 1. Chunkare il testo lato backend (emettere delta di ~20 chars ogni 10ms)
> 2. Oppure animare lato frontend (più pulito)
>
> I tool calls invece arrivano in real-time con eventi `tool_progress`.

---

## Architettura Completa

```
                                    ┌─────────────────────────────────────────────┐
                                    │            HETZNER VPS                       │
                                    │                                             │
 ┌──────────┐    HTTPS              │  ┌───────────────────────────────────────┐  │
 │ Browser  │ ◄─────────────────────┼─►│  Gateway Container (FastAPI)          │  │
 │ (PWA)    │                       │  │                                       │  │
 └──────────┘                       │  │  • Auth (Supabase)                    │  │
                                    │  │  • Chat CRUD (Piccolo ORM)            │  │
                                    │  │  • Static files (Canvas UI)           │  │
                                    │  │  • Session router                     │  │
                                    │  └───────┬───────────────────┬───────────┘  │
                                    │          │                   │               │
                                    │          ▼                   ▼               │
                                    │  ┌───────────────┐  ┌───────────────────┐   │
                                    │  │ User Container │  │ User Container    │   │
                                    │  │ (cloud mode)   │  │ (cloud mode)      │   │
                                    │  │                │  │                   │   │
                                    │  │ • claude CLI   │  │ • claude CLI      │   │
                                    │  │ • git repos    │  │ • git repos       │   │
                                    │  │ • OpenRouter   │  │ • OpenRouter      │   │
                                    │  └───────────────┘  └───────────────────┘   │
                                    │          │                                   │
                                    │          │ Tailscale                         │
                                    │          ▼                                   │
                                    │  ┌───────────────┐                          │
                                    │  │ Edge Daemon    │  ← PC utente (locale)   │
                                    │  │ (local mode)   │                          │
                                    │  │ • claude CLI   │                          │
                                    │  │ • file locali  │                          │
                                    │  └───────────────┘                          │
                                    └─────────────────────────────────────────────┘
```

### Session Routing

```python
async def route_to_claude(user_id: str, prompt: str, session_id: str | None):
    """Decide se usare il container cloud o il PC locale dell'utente."""
    
    if await is_edge_online(user_id):  # heartbeat via Tailscale
        # MODO LOCALE: inoltra al daemon sull'edge
        return await forward_to_edge(user_id, prompt, session_id)
    else:
        # MODO CLOUD: usa il container Docker dell'utente
        container = await get_or_create_container(user_id)
        return await run_claude_in_container(container, prompt, session_id)
```

---

## Stack Finale (Post-Pivot)

### Gateway (quello che scriviamo noi)

| File | Righe stimate | Responsabilità |
|------|:---:|---|
| `main.py` | ~60 | FastAPI app, static mount, startup/shutdown |
| `auth.py` | ~50 | Middleware Supabase JWT verification |
| `bridge.py` | ~200 | **Core**: spawn `claude`, traduci NDJSON → SSE |
| `chats.py` | ~80 | CRUD chat (riuso logica da `plugins/chats/`) |
| `containers.py` | ~120 | Docker SDK: create/start/stop container per user |
| `edge.py` | ~80 | Tailscale heartbeat + forward a edge daemon |
| `db.py` | ~30 | Piccolo ORM setup (SQLite/Postgres) |
| **Totale** | **~620** | |

### Cosa si Elimina

| Componente eliminato | Peso stimato |
|---|---|
| `cheshire-cat-ai` (runtime + deps) | ~200MB, 50+ file |
| 16 direttive in `core_directives/` | 17 file Python |
| Plugin `workspace_agent/` | Intero agent framework |
| Plugin `mcp_client/` | 8 file, MCP custom client |
| Plugin `llms/` | Provider management |
| Plugin `fs_memory/` | Memory system |
| `bundle.js` (vecchia UI React) | 1MB compiled |

### Cosa si Mantiene (con modifiche minime)

| Componente | Modifiche necessarie |
|---|---|
| Canvas UI (`public/`) | Cambiare gli endpoint in `api.js`, rimuovere refs a Cat |
| Auth Supabase | Estratta da plugin, diventa middleware standalone |
| Chat CRUD + DB | Estratta da plugin, ORM resta Piccolo |
| Design System (`themes.css`) | Invariato |
| Docker + Tailscale infra | Dockerfile rifatto (più snello) |

---

## Modifiche Frontend (Minime)

### `api.js`
```diff
- static BASE_URL = window.location.origin;
+ static BASE_URL = window.location.origin + '/api';

  // Rimuovere endpoint non più necessari:
- static async getLLMs() { ... }
- static async getPlugins() { ... }
- static async togglePlugin() { ... }
```

### `view_chat.js`
```diff
  // Il protocollo SSE resta identico!
  // L'unica modifica: il tool rendering mostra i tool di Claude Code
  // (Bash, Read, Write, etc.) invece dei tool Cat
  
+ // Nuovo: mostrare anche TOOL_RESULT events
+ case 'TOOL_RESULT':
+     renderToolResult(data.tool_call_id, data.content);
+     break;

+ // Nuovo: mostrare costo/usage a fine run  
  case 'RUN_FINISHED':
      // ...existing logic...
+     if (data.usage) showUsageBadge(data.usage);
      break;
```

### `router.js`
```diff
  // Rimuovere rotte non più necessarie:
- '#plugins': { ... }
- '#agents': { ... }  // o riusare per selezionare il "modo" (local vs cloud)
```

---

## Multi-User con Container Isolati

> [!IMPORTANT]
> Ogni utente ottiene il proprio container Docker con Claude Code. Questo garantisce isolamento dei file, delle sessioni, e delle API key.

### Docker Container per Utente

```dockerfile
# user-agent.Dockerfile
FROM node:20-slim

# Installa Claude Code
RUN npm i -g @anthropic-ai/claude-code

# Crea workspace
RUN mkdir -p /workspace
WORKDIR /workspace

# Entrypoint: resta in vita e accetta comandi via stdin/socket
ENTRYPOINT ["tail", "-f", "/dev/null"]
```

Il gateway comunica con ogni container via **Docker exec**:
```python
async def run_claude_in_container(container_id: str, prompt: str, session_id: str | None):
    cmd = [
        "claude", "-p", prompt,
        "--output-format", "stream-json",
        "--verbose",
        "--dangerously-skip-permissions",
    ]
    if session_id:
        cmd.extend(["--resume", session_id])
    
    # Docker SDK: exec_create + exec_start con stream=True
    exec_id = container.exec_create(cmd, environment={
        "ANTHROPIC_BASE_URL": "https://openrouter.ai/api",
        "ANTHROPIC_AUTH_TOKEN": user.openrouter_key,
        "ANTHROPIC_API_KEY": "",
    })
    return container.exec_start(exec_id, stream=True)
```

### Lifecycle dei Container
- **Creazione**: Lazy — il primo messaggio dell'utente crea il container
- **Idle timeout**: Container stoppato dopo 30 min di inattività
- **Repo sync**: `git clone` al primo uso, `git pull` ad ogni riavvio
- **Limiti**: CPU/memory limits per container via Docker

---

## Piano di Esecuzione

### Fase 1 — Backend Gateway (~2 giorni)
- [ ] `main.py`: FastAPI standalone, mount statico della Canvas UI
- [ ] `auth.py`: Supabase JWT middleware (estratto da `supabase_auth/auth.py`)
- [ ] `db.py` + `chats.py`: Schema + CRUD chat (estratto da `plugins/chats/`)
- [ ] `bridge.py`: **Core bridge** — spawn `claude -p`, parse NDJSON, emetti SSE
- [ ] Test locale: invio messaggio → risposta streamata nella chat

### Fase 2 — Frontend Adattamento (~1 giorno)
- [ ] `api.js`: Aggiorna endpoint base, rimuovi refs Cat
- [ ] `view_chat.js`: Aggiungi rendering `TOOL_RESULT`, usage badge
- [ ] `router.js`: Rimuovi rotte obsolete (plugins, agents gallery)
- [ ] `view_settings.js`: Aggiorna per configurazione OpenRouter key + mode
- [ ] Test E2E: chat flow completo con design Neo-Brutalist

### Fase 3 — Multi-User Containers (~2 giorni)
- [ ] `containers.py`: Docker SDK per lifecycle container per utente
- [ ] `user-agent.Dockerfile`: Immagine con Claude Code + git
- [ ] Session mapping: chat_id ↔ claude session_id
- [ ] Idle timeout + auto-start/stop

### Fase 4 — Dual-Mode (Locale + Cloud) (~1 giorno)
- [ ] `edge.py`: Tailscale heartbeat check
- [ ] Edge daemon script (Python leggero per PC utente)
- [ ] Session routing in `bridge.py`

### Fase 5 — Deploy + Polish (~1 giorno)
- [ ] Nuovo `Dockerfile` per il gateway
- [ ] `docker-compose.yml` aggiornato
- [ ] PWA manifest
- [ ] Error handling, reconnection, loading states

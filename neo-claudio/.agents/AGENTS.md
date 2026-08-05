# Neo-Claudio — Guida Operativa per Agenti

> **Neo-Claudio** è un'interfaccia web che trasforma Claude Code CLI in un'applicazione multi-sessione, multi-progetto e multi-utente con design Neo-Brutalist.
> Il progetto fa parte dell'ecosistema **Stregatto** (Cheshire Cat) ed era precedentemente noto come `stregatto_v3`.

---

## 1. Cos'è Neo-Claudio (in 30 secondi)

Neo-Claudio è un **ponte web verso Claude Code CLI**. L'utente apre un browser, sceglie un progetto e una configurazione agente (Agent Preset), e interagisce con Claude Code tramite un terminale web (xterm.js) connesso a un pseudoterminale (PTY) sul backend. 

A differenza di un semplice "terminale nel browser", Neo-Claudio aggiunge:
- **Progetti**: Cartelle di lavoro organizzate nella sidebar sinistra
- **Sessioni con tab**: Più terminali Claude Code aperti contemporaneamente, pinnabili e archiviabili
- **Agent Gallery**: Preset riutilizzabili (modello, system prompt, permessi, tool consentiti)
- **MCP Apps**: Sidebar destra con UI interattive servite da server MCP (iframe sandboxati)
- **Dual execution**: Locale (tunnel Tailscale verso il PC dell'utente) o Cloud (Docker su VPS)
- **Design Neo-Brutalist**: Tema chiaro con dot grid, bordi netti, ombre offset, accento arancione

---

## 2. Struttura del Progetto

```text
neo-claudio/
├── agent.md              # ← Questo file. Leggilo per primo.
├── app/                  # Backend FastAPI (Python)
│   ├── __init__.py
│   ├── main.py           # Entry point, middleware CORS, rotte core, static mount
│   ├── bridge.py         # [DEPRECATO] Bridge NDJSON → SSE — DA SOSTITUIRE con pty_manager.py
│   ├── auth.py           # Autenticazione JWT Supabase + fallback dev locale
│   ├── chats.py          # [DEPRECATO] CRUD chat — DA SOSTITUIRE con projects.py + sessions.py
│   └── db.py             # Piccolo ORM (SQLite locale / PostgreSQL cloud)
├── docs/                 # Documentazione architetturale (8 micro-step)
│   ├── 00_implementation_plan.md   # Piano master con architettura target
│   ├── 01_pty_infrastructure_and_websocket.md
│   ├── 02_xterm_integration_and_light_theme.md
│   ├── 03_project_and_session_data_model.md
│   ├── 04_left_sidebar_project_navigator.md
│   ├── 05_tab_bar_session_management.md
│   ├── 06_agent_gallery_and_toolbar.md
│   └── 07_right_sidebar_mcp_apps.md
└── static/               # Frontend SPA (Vanilla JS + Tailwind CSS)
    ├── index.html         # Shell HTML principale
    ├── css/
    │   └── themes.css     # Design system Neo-Brutalist
    └── js/
        ├── app.js         # Orchestratore SPA, routing, inizializzazione
        ├── api.js         # Wrapper chiamate REST verso il backend
        ├── auth.js        # Login/logout Supabase lato client
        ├── cat_client.js  # Client per l'API Stregatto/Cat
        ├── i18n.js        # Internazionalizzazione (IT/EN)
        ├── router.js      # Router SPA hash-based
        ├── view_chat.js   # [73KB — DA RISCRIVERE] Vista chat principale (SSE-based)
        ├── view_agents.js # Vista agenti
        ├── view_history.js# Vista storico
        ├── view_login.js  # Vista login
        ├── view_register.js # Vista registrazione
        ├── view_plugins.js  # Vista plugin
        └── view_settings.js # Vista impostazioni
```

---

## 3. Architettura Attuale vs Architettura Target

### Architettura ATTUALE (da dismettere)

```text
Browser ──► SSE (text/event-stream) ──► FastAPI ──► subprocess.Popen ──► claude -p "..." --output-format stream-json
                                          │
                                    bridge.py parsa
                                    NDJSON riga per riga
                                    e converte in eventi SSE
```

**Problemi**: Il parser NDJSON in `bridge.py` è fragile, la comunicazione è unidirezionale (no tool approval interattivo), ogni feature della CLI richiede un parser ad-hoc, ogni aggiornamento della CLI può rompere il mapping.

### Architettura TARGET (da implementare)

```text
Browser ◄──WebSocket──► FastAPI ◄──PTY──► claude (modalità interattiva)
   │                       │
   │ xterm.js              │ pty_manager.py
   │ (rendering terminale) │ (spawn/read/write/resize/kill)
   │                       │
   └── Toolbar + Sidebar ──┘
```

**Vantaggi**: Zero parsing, 100% feature parity con la CLI, comunicazione bidirezionale nativa, supporto completo a permessi e tool approval interattivi.

### Layout Target della UI

```text
┌─ Sidebar SX ──────┐ ┌─ Tab Bar ─────────────────────────┐ ┌─ Sidebar DX ──┐
│                    │ │ 📌 Setup │ Auth │ Bug │ 📦(3) │ + │ │               │
│ PROGETTI           │ ├─ Toolbar ──────────────────────────┤ │  MCP Apps     │
│ 📁 project-api    │ │ 🤖 Sonnet▾│📎 [img.png✕]│⚙️│ ⏹   │ │ (iframe)      │
│ 📁 portfolio      │ ├────────────────────────────────────┤ │               │
│                    │ │ · · · · · · · · · · · · · · · · · │ │ ┌───────────┐ │
│ ────────────────── │ │ ·  xterm.js (light + dot grid)  · │ │ │ DB View   │ │
│ [+ Progetto]       │ │ ·  PTY bidirezionale            · │ │ └───────────┘ │
│ [🤖 Gallery]       │ │ · · · · · · · · · · · · · · · · · │ │               │
└────────────────────┘ └────────────────────────────────────┘ └───────────────┘
```

---

## 4. Stack Tecnologico

| Layer | Tecnologia | Note |
|-------|------------|------|
| **Backend** | Python 3.11+, FastAPI, Uvicorn | Entry point: `app/main.py` |
| **ORM** | Piccolo (async) | SQLite in dev, PostgreSQL in prod |
| **PTY** | `pywinpty` (Windows), `pty` (Unix) | Sostituisce subprocess.Popen |
| **Transport** | WebSocket (FastAPI native) | Bidirezionale, JSON messages |
| **Frontend** | Vanilla JS (no framework) | SPA con routing hash-based |
| **Styling** | Tailwind CSS (CDN) | Design system Neo-Brutalist |
| **Terminale** | xterm.js v5 (CDN) | Con addon: fit, webLinks, search |
| **Auth** | Supabase JWT (HS256) | Fallback automatico in dev locale |
| **Deploy Cloud** | Docker, Hetzner VPS | Container isolati per utente |
| **Deploy Locale** | Tailscale tunnel | PTY sul PC dell'utente |

---

## 5. Design System — Soft Neo-Brutalist

### Regole fondamentali

```css
/* Bordi */
border: 2px solid #1A1C1C;
border-radius: 0px;                           /* MAI arrotondare */

/* Ombre (stato default) */
box-shadow: 4px 4px 0px 0px #1A1C1C;

/* Ombre (stato hover/attivo) */
box-shadow: 2px 2px 0px 0px #FF5F1F;

/* Dot grid (sfondo terminale e aree principali) */
background-image: radial-gradient(circle, #D4D4D4 1px, transparent 1px);
background-size: 20px 20px;
```

### Palette colori

| Ruolo | Colore | Hex |
|-------|--------|-----|
| Primario / Accento | Arancione internazionale | `#FF5F1F` |
| Primario scuro | Arancione bruciato | `#AB3600` |
| Sfondo superfici | Bianco | `#FFFFFF` |
| Sfondo container | Grigio chiaro | `#EEEEEE` / `#F9F9F9` |
| Testo e bordi | Nero opaco | `#1A1C1C` |

### Tipografia

| Uso | Font |
|-----|------|
| Intestazioni, bottoni, tag, badge | **Space Grotesk** (Google Fonts) |
| Corpo del testo, messaggi | **Work Sans** / **Segoe UI** |
| Terminale (xterm.js) | **Cascadia Code** / **Fira Code** / **JetBrains Mono** |

### Principi di design

1. **Mai `border-radius`** — Tutto è rettangolare con angoli netti
2. **Ombre rigide** — Offset fisso (`4px 4px`), mai blur
3. **Colore arancione solo per accenti** — Focus, hover, selezione, cursore
4. **Tema chiaro** — Sfondo bianco/chiaro, testo scuro
5. **Dot grid sottile** — Traspare dietro il terminale, dà profondità senza distrarre

---

## 6. Modello Dati (Target)

### ProjectDB (`stregatto_projects`)
Rappresenta una cartella di lavoro. Ogni progetto contiene N sessioni.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | Text (PK) | UUID4 |
| `user_id` | Text | Proprietario |
| `name` | Text | Nome visualizzato |
| `path` | Text | Path assoluto della cartella di progetto |
| `mode` | Text | `'local'` (Tailscale) o `'cloud'` (Docker) |
| `icon` | Text | Emoji |
| `default_preset_id` | Text (FK) | Preset agente di default |
| `pinned` | Boolean | Pinnato in cima alla sidebar |

### SessionDB (`stregatto_sessions`) — sostituisce ChatDB
Ogni sessione è un'istanza PTY di Claude Code all'interno di un progetto.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | Text (PK) | UUID4 |
| `project_id` | Text (FK) | Progetto padre |
| `user_id` | Text | Proprietario |
| `name` | Text | Nome della sessione |
| `claude_session_id` | Text | Session ID per `--resume` |
| `preset_id` | Text (FK) | Agent Preset usato |
| `model` | Text | Modello attivo |
| `state` | Text | `'active'` / `'suspended'` / `'archived'` |
| `pinned` | Boolean | Tab pinnata |
| `tab_order` | Integer | Ordine nella tab bar |

### AgentPresetDB (`stregatto_agent_presets`)
Configurazione riutilizzabile per lanciare Claude Code con parametri specifici.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | Text (PK) | UUID4 |
| `user_id` | Text | Proprietario (o `'system'` per built-in) |
| `slug` | Text | Identificativo unico |
| `name` | Text | Nome visualizzato |
| `icon` | Text | Emoji |
| `model` | Text | Modello LLM |
| `system_prompt` | Text | System prompt custom |
| `permission_mode` | Text | `plan` / `auto` / `acceptEdits` / `bypassPermissions` |
| `allowed_tools` | JSON | Lista tool consentiti (vuota = tutti) |
| `mcp_servers` | JSON | Server MCP da abilitare |

### Preset built-in (seed)

| Preset | Modello | Permessi | Tool | Caso d'uso |
|--------|---------|----------|------|------------|
| 🐱 **Stregatto** | Sonnet 4 | auto | Tutti | Default, sviluppo generico |
| 🛡️ **Guardian** | Opus 4 | plan | Read, Grep, Glob | Code review, analisi sicurezza |
| 🔬 **Researcher** | Sonnet 4 | auto | Read, Grep, Glob, WebFetch | Ricerca, documentazione |

---

## 7. Protocollo WebSocket (PTY)

Endpoint: `ws://host/ws/pty/{session_id}?token=<jwt>`

### Client → Server

```json
{"type": "input", "data": "ls -la\n"}
{"type": "resize", "cols": 120, "rows": 40}
{"type": "ping"}
```

### Server → Client

```json
{"type": "output", "data": "<base64-encoded-terminal-data>"}
{"type": "exit", "code": 0}
{"type": "pong"}
{"type": "error", "message": "Session not found"}
{"type": "session_info", "session_id": "...", "pid": 1234}
```

---

## 8. API REST (Target)

### Progetti
| Metodo | Rotta | Descrizione |
|--------|-------|-------------|
| `GET` | `/projects` | Lista progetti dell'utente |
| `POST` | `/projects` | Crea progetto |
| `PUT` | `/projects/{id}` | Aggiorna progetto |
| `DELETE` | `/projects/{id}` | Elimina progetto e sessioni |

### Sessioni
| Metodo | Rotta | Descrizione |
|--------|-------|-------------|
| `GET` | `/projects/{id}/sessions` | Lista sessioni del progetto |
| `POST` | `/projects/{id}/sessions` | Crea sessione (con preset) |
| `PUT` | `/sessions/{id}` | Aggiorna sessione |
| `PUT` | `/sessions/{id}/suspend` | Sospendi (kill PTY, mantieni session_id) |
| `PUT` | `/sessions/{id}/resume` | Riprendi con `--resume` |
| `PUT` | `/sessions/{id}/archive` | Archivia |
| `DELETE` | `/sessions/{id}` | Elimina permanentemente |

### Preset
| Metodo | Rotta | Descrizione |
|--------|-------|-------------|
| `GET` | `/presets` | Lista preset (system + custom) |
| `POST` | `/presets` | Crea preset custom |
| `PUT` | `/presets/{id}` | Aggiorna |
| `DELETE` | `/presets/{id}` | Elimina (non i system) |

### Altro (invariato)
| Metodo | Rotta | Descrizione |
|--------|-------|-------------|
| `GET` | `/canvas/config` | Config pubblica Supabase |
| `GET` | `/llms` | Modelli disponibili |
| `GET/PUT` | `/settings` | Impostazioni utente |
| `POST` | `/uploads` | Upload file/immagini |

---

## 9. Roadmap di Implementazione

La documentazione dettagliata di ogni step si trova nella cartella `docs/`. I documenti contengono codice completo e runnable.

```text
Fase 1 — Core (parallelizzabile)
├── Step 01: PTY Infrastructure + WebSocket    (docs/01_...)
├── Step 02: xterm.js + Tema Chiaro Dot Grid   (docs/02_...)
├── Step 03: Data Model (Project/Session/Preset)(docs/03_...)
│
Fase 2 — UI Shell
├── Step 04: Sidebar SX — Navigatore Progetti  (docs/04_...)
├── Step 05: Tab Bar — Gestione Sessioni       (docs/05_...)
│
Fase 3 — Power Features
├── Step 06: Agent Gallery + Toolbar           (docs/06_...)
└── Step 07: Sidebar DX — MCP Apps             (docs/07_...)
```

**Grafo delle dipendenze:**
- Step 01 + 02 ← possono essere sviluppati in parallelo con Step 03 + 04
- Step 05 ← dipende da 01, 02, 03
- Step 06 ← dipende da 04, 05
- Step 07 ← dipende da 06

---

## 10. Come Lavorare su Questo Progetto

### Avviare il backend

```bash
cd neo-claudio
pip install fastapi uvicorn piccolo[all] pywinpty python-dotenv pyjwt
python -m app.main
# oppure
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

L'app è accessibile su `http://localhost:8000/` (serve `static/index.html`).

### Variabili d'ambiente (`.env` alla root del repo)

```env
# Opzionali — il sistema funziona senza in dev locale
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_JWT_SECRET=your-secret
OPENROUTER_API_KEY=sk-or-v1-...
DATABASE_URL=postgresql://...   # se omesso, usa SQLite (core.db)
```

### Convenzioni di codice

1. **Backend Python**: type hints obbligatori, async/await per tutto l'I/O, docstring in italiano
2. **Frontend JS**: Vanilla JS, no framework, no build step. Moduli caricati come script tag nell'HTML
3. **CSS**: Tailwind via CDN + `themes.css` per regole custom. MAI usare `border-radius`
4. **API**: RESTful, JSON body, autenticazione via `Depends(get_current_user)` su ogni rotta
5. **DB**: Piccolo ORM, ogni tabella ha `class Meta` con `tablename` e `db = DB_ENGINE`

### File da NON toccare (stabili)

- `app/auth.py` — Funziona, testato, ha il fallback dev locale
- `static/js/auth.js` — Client Supabase
- `static/js/i18n.js` — Internazionalizzazione

### File da SOSTITUIRE (deprecati)

- `app/bridge.py` → Sarà sostituito da `app/pty_manager.py` (Step 01)
- `app/chats.py` → Sarà sostituito da `app/projects.py` + `app/sessions.py` (Step 03)
- `static/js/view_chat.js` (73KB) → Riscrittura totale con xterm.js (Step 02)

### Riferimenti documentali

- **Piano master**: `docs/00_implementation_plan.md`
- **Specifiche per step**: `docs/01_...` fino a `docs/07_...`
- Ogni doc contiene codice completo e pronto per essere copiato nei file target

### Debugging e test

- Il backend logga su stdout con `logging` (livello INFO)
- In dev locale, l'auth restituisce sempre `local_dev_user` — nessun login richiesto
- Il DB SQLite si crea automaticamente al primo avvio (`core.db`)
- Per testare il WebSocket PTY: usa `websocat` o una pagina HTML minimale

---

## 11. Concetti Chiave da Ricordare

1. **Il terminale È l'interfaccia di chat.** Non ci sono message bubble, non c'è rendering custom dei messaggi. L'utente interagisce con Claude Code direttamente nel terminale.

2. **Zero parsing dell'output CLI.** Tutto il rendering è delegato a xterm.js. Il backend è un puro proxy PTY ↔ WebSocket. Questa è una scelta architetturale intenzionale per eliminare la fragilità del vecchio bridge NDJSON.

3. **La UI Neo-Brutalist vive nel "chrome" dell'app** (sidebar, tab bar, toolbar, modali), non nel contenuto del terminale. Il terminale stesso è tematizzato con colori coerenti ma resta un terminale.

4. **Dual execution** significa che lo stesso frontend può connettersi a un PTY locale (via Tailscale, per lavorare sui file reali dell'utente a costo zero) o a un PTY cloud (Docker su VPS, per uso leggero/mobile).

5. **Agent Presets** sono il meccanismo di personalizzazione. Non esistono "agenti" Python in-process come in Cheshire Cat V2 — l'intelligenza è tutta in Claude Code CLI, configurato tramite flag CLI derivati dal preset.

6. **MCP Apps** nella sidebar destra sono il punto di estensione per UI ricche. Qualsiasi funzionalità che richiede un'interfaccia visuale (diff viewer, DB explorer, file browser) vive come MCP App, non come componente hardcoded nel frontend.

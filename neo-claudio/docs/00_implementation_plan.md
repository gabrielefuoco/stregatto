# Stregatto V3 — Piano di Implementazione: Migrazione a Architettura PTY

## Contesto e Motivazione

- **Fragilità NDJSON**: L'attuale bridge NDJSON (`bridge.py`) è fragile: ogni nuova feature della CLI di Claude Code richiede parser ad-hoc e gestione specifica degli eventi.
- **Limiti di Input**: La comunicazione bidirezionale (come le richieste di permessi, tool approval) è gestita come un hack rudimentale sullo standard input (`stdin`).
- **Rischio Breaking Changes**: Ogni aggiornamento minore della CLI di Claude Code può potenzialmente rompere il mapping degli eventi.
- **Soluzione**: Sostituire interamente il bridge basato su eventi con un'architettura **PTY nativa + xterm.js**. Questo garantisce il 100% di feature parity (inclusi i prompt interattivi, colori ANSI, e spinner) senza bisogno di alcun parsing intermedio.

## Architettura Target

L'applicazione Stregatto V3 seguirà un layout moderno a pannelli scorrevoli e terminale centrale, ispirato a IDE e interfacce di sviluppo avanzate. Il design seguirà lo stile **Neo-Brutalist** (bordi spessi, angoli acuti, ombre nette, con accento arancione `#FF5F1F`).

```text
+-----------------------------------------------------------------------------+
| Navbar Superiore (Brand, Switch Execution: Local/Cloud, User Profile)       |
+-----------+-----------------------------------------------------+-----------+
| Left      | Toolbar: Model | File Attach | Agent Preset | Stop  | Right     |
| Sidebar:  |-----------------------------------------------------| Sidebar:  |
| Projects  | Tab Bar: Session 1 (pin) | Session 2 (archived)     | MCP Apps  |
|           |-----------------------------------------------------|           |
| - Proj A  |                                                     | - App 1   |
|   (paths) |                                                     |   (iframe)|
| - Proj B  |                    xterm.js                         |           |
| - Proj C  |                  TERMINAL AREA                      | - App 2   |
|           |            (Light Theme, Dot Grid bg,               |           |
|           |             Neo-Brutalist borders)                  | - App 3   |
|           |                                                     |           |
|           |                                                     |           |
|           |                                                     |           |
+-----------+-----------------------------------------------------+-----------+
```

### Componenti Principali:
- **Left sidebar**: `Projects` (cartelle di lavoro dove viene eseguito Claude), NON chat.
- **Tab bar**: `Sessions` per ogni progetto. Supporto per pin, archiviazione e rinomina.
- **Center**: Terminale `xterm.js` integrato, renderizzato su uno sfondo light con dot grid e bordi Neo-Brutalist.
- **Toolbar (sopra xterm)**: Selettore del modello AI, allegati file rapido, indicatore del preset dell'Agente, bottone Stop (interrupt rapido).
- **Right sidebar**: Pannello `MCP Apps`, moduli indipendenti renderizzati come iframe isolati in sandbox.
- **Dual Execution Model**:
  - **Local**: Tunnel via Tailscale al PC dell'utente, eseguendo PTY nativo.
  - **Cloud**: Sandbox isolata via Docker/gVisor ospitata su VPS.
- **WebSocket Transport**: Canale bidirezionale tra browser (xterm) e il manager PTY su FastAPI.

## Stato Attuale del Codebase

Analisi dei file attuali e del loro destino nel nuovo paradigma:

- `app/main.py` (271 lines): FastAPI entry point, REST routes, SSE streaming via bridge. **DA MODIFICARE** (rimuovere SSE, integrare WebSockets per PTY).
- `app/bridge.py` (323 lines): NDJSON subprocess manager. **DA ELIMINARE** e rimpiazzare con `pty_manager.py`.
- `app/auth.py` (68 lines): JWT Supabase auth. **MANTENUTO AS-IS**.
- `app/chats.py` (143 lines): Chat CRUD. **DA REFACTORIZZARE** e scindere in `projects.py` + `sessions.py`.
- `app/db.py` (57 lines): Piccolo ORM models. **DA ESTENDERE** con le nuove tabelle.
- `static/index.html` (12KB): Main HTML shell. **DA AGGIORNARE** con il nuovo layout Neo-Brutalist.
- `static/js/view_chat.js` (73KB): Main chat view. **MAJOR REWRITE**: da chat interface a `xterm.js` terminal window.
- `static/js/` (11 other JS files): Varie UI views. **DA AGGIORNARE/CONSOLIDARE**.
- `static/css/themes.css` (4KB): Theme definitions. **DA AGGIORNARE** con design system target e `dot-grid`.

## Mappa degli Step di Implementazione

La migrazione avverrà in 7 step modulari e indipendenti:

| Step | Titolo e Riferimento | Descrizione Breve | File Modificati / Creati / Eliminati | Dipendenze | Complessità |
|------|----------------------|-------------------|--------------------------------------|------------|-------------|
| 1 | PTY Infrastructure & WebSocket Transport | Implementazione del backend PTY in Python (usando `pty`/`psutil`) e route WebSocket in FastAPI per I/O bidirezionale. | Creato: `app/pty_manager.py`, `app/ws_routes.py`. Modificato: `app/main.py`. | Nessuna (sviluppo parallelo) | Alta |
| 2 | xterm.js Integration & Light Theme con Dot Grid | Inserimento della libreria xterm.js nel frontend per visualizzare l'output PTY. Implementazione tema Light con Dot Grid e Neo-Brutalist styling. | Creato: `static/js/terminal.js`. Modificato: `index.html`, `themes.css`, `view_chat.js`. Eliminato: `app/bridge.py` | Step 1 | Media |
| 3 | Project & Session Data Model | Refactoring del database. Sostituzione delle "Chat" con "Progetti" (directory fisiche) e "Sessioni" (esecuzioni PTY). | Creato: `app/projects.py`, `app/sessions.py`. Modificato: `app/db.py`. Eliminato: `app/chats.py` | Nessuna | Bassa |
| 4 | Left Sidebar: Project Navigator | Implementazione UI per il Project Navigator a sinistra. Creazione/gestione directory. | Modificato: `index.html`, script frontend collegati. | Step 3 | Bassa |
| 5 | Tab Bar: Session Management | Implementazione barra dei tab sopra il terminale per pin, archiviazione e ridenominazione delle sessioni. | Modificato: `index.html`, script frontend collegati. | Steps 2, 3 | Media |
| 6 | Agent Gallery & Toolbar | Toolbar per la configurazione del prompt iniziale: selezione modello, preset agente e interrupt PTY (Stop). | Modificato: `index.html`, integrazione con backend per flags CLI. | Step 2 | Bassa |
| 7 | Right Sidebar: MCP Apps Panel | Inclusione iframe sandboxed sulla destra per app MCP specifiche in base al progetto. | Modificato: `index.html`, `static/css/...` | Nessuna | Media |

## Modello Dati Target

Le strutture dati basate su Piccolo ORM per il nuovo paradigma:

```python
from piccolo.columns import Varchar, Text, Boolean, UUID, Timestamp, ForeignKey
from piccolo.table import Table

class ProjectDB(Table, tablename="stregatto_projects"):
    id = UUID(primary_key=True)
    user_id = UUID(index=True)
    name = Varchar(length=100)
    directory_path = Varchar(length=512)
    created_at = Timestamp()
    updated_at = Timestamp()

class SessionDB(Table, tablename="stregatto_sessions"):
    id = UUID(primary_key=True)
    project_id = ForeignKey(references=ProjectDB)
    name = Varchar(length=100)  # Es. "Fix Login Bug"
    is_pinned = Boolean(default=False)
    is_archived = Boolean(default=False)
    created_at = Timestamp()
    last_accessed = Timestamp()
    
class AgentPresetDB(Table, tablename="stregatto_agent_presets"):
    id = UUID(primary_key=True)
    name = Varchar(length=100)
    system_prompt = Text()
    theme_color = Varchar(length=7) # Es. "#FF5F1F"
    icon = Varchar(length=50)

class UserSettingsDB(Table, tablename="stregatto_user_settings"):
    id = UUID(primary_key=True)
    user_id = UUID(unique=True)
    execution_mode = Varchar(choices=['local', 'cloud'], default='local')
    default_model = Varchar(length=50)
```

## Protocollo WebSocket

La comunicazione tra browser e backend per il terminale seguirà un semplice protocollo JSON:

### Da Client a Server (Client→Server)
- **Input utente**: `{ "type": "input", "data": "ls -la\r" }` (tasti premuti o copia/incolla).
- **Resize terminale**: `{ "type": "resize", "cols": 120, "rows": 40 }` (quando il browser o il pannello cambiano dimensioni).
- **Keep-alive**: `{ "type": "ping" }`

### Da Server a Client (Server→Client)
- **Output PTY**: `{ "type": "output", "data": "\u001b[32muser@host\u001b[0m:~$ " }` (stream raw ANSI).
- **Terminazione**: `{ "type": "exit", "code": 0 }` (quando il processo termina).
- **Keep-alive**: `{ "type": "pong" }`
- **Errori**: `{ "type": "error", "message": "PTY process crashed" }`

## Strategia di Migrazione

- **Sviluppo Parallelo**: Gli step 1-2 possono essere sviluppati in parallelo agli step 3-5.
- **Indipendenza**: Ogni step è indipendente e testabile autonomamente.
- **Backward Compatibility Temporanea**: Il vecchio `bridge.py` verrà mantenuto finché lo step 2 non sarà completato, dopodiché verrà rimosso.
- **Nessuna Breaking Change all'Auth**: Non verranno introdotte modifiche a `auth.py`. Le chiamate manterranno l'integrità del sistema JWT esistente.

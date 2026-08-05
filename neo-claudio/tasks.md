# Neo-Claudio — Task List di Refactor

> **ISTRUZIONI PER L'AGENTE**
> 
> 1. **Leggi questo file all'inizio di ogni sessione di lavoro.**
> 2. **Aggiorna questo file in tempo reale** man mano che completi le azioni:
>    - `[ ]` → azione da fare
>    - `[/]` → azione in corso
>    - `[x]` → azione completata
> 3. **Non fermarti finché tutte le azioni di uno step non sono `[x]`.** Se incontri un blocco, documenta il problema sotto l'azione e passa alla prossima azione indipendente.
> 4. **Verifica ogni azione** prima di marcarla `[x]`: il codice deve essere sintatticamente valido, i file devono esistere, le API devono rispondere.
> 5. **Leggi la documentazione di ogni step** nella cartella `docs/` PRIMA di iniziare a lavorare su quello step. Ogni doc contiene codice completo e specifiche.
> 6. **Non modificare file marcati come "stabile"** (`auth.py`, `auth.js`, `i18n.js`) a meno che non sia strettamente necessario.
> 7. **Testa dopo ogni step completato**: avvia il server con `uvicorn app.main:app --reload` e verifica che non ci siano errori di import o crash all'avvio.

---

## Step 01 — Infrastruttura PTY e Trasporto WebSocket

📄 Documentazione: `docs/01_pty_infrastructure_and_websocket.md`

### Dipendenze

- [x] Creare `requirements.txt` nella root di `neo-claudio` con tutte le dipendenze:
  - `fastapi`, `uvicorn[standard]`, `piccolo[all]`, `python-dotenv`, `pyjwt`
  - `pywinpty` (Windows) / nota che `pty` è builtin su Unix
  - `websockets` (se non incluso in uvicorn[standard])
- [x] Installare le dipendenze e verificare che `import winpty` (Windows) o `import pty` (Unix) funzioni

### PTY Manager

- [x] Creare `app/pty_manager.py` con la classe `PTYSession` (dataclass):
  - Campi: `session_id`, `process`, `pty_handle`, `project_id`, `preset_slug`, `cols`, `rows`, `created_at`
- [x] Implementare `PTYManager.__init__()`: dizionario in-memory delle sessioni attive
- [x] Implementare `PTYManager.spawn(session_id, command, cwd, env, cols, rows)`:
  - Windows: usare `winpty.PtyProcess.spawn()` con ConPTY
  - Unix: usare `pty.openpty()` + `subprocess.Popen`
  - Registrare la sessione nel dizionario
- [x] Implementare `PTYManager.read(session_id)`: lettura non bloccante dallo stdout del PTY
- [x] Implementare `PTYManager.write(session_id, data)`: scrittura nello stdin del PTY
- [x] Implementare `PTYManager.resize(session_id, cols, rows)`: ridimensionamento terminale
- [x] Implementare `PTYManager.kill(session_id)`:
  - Windows: `taskkill /F /T /PID`
  - Unix: `SIGTERM` → attesa 2s → `SIGKILL`
  - Rimuovere la sessione dal dizionario
- [x] Implementare `PTYManager.kill_all()`: cleanup all'arresto dell'app
- [x] Implementare `PTYManager.list_sessions()` e `PTYManager.get_session(session_id)`
- [x] Implementare `build_claude_command(preset, cwd)`:
  - Risolvere l'eseguibile `claude` (stessa logica di `bridge.py` ma SENZA `--output-format stream-json` e SENZA `-p`)
  - Applicare flag dal preset: `--model`, `--system-prompt`, `--permission-mode`, `--allowedTools`, `--name`
  - Se c'è OpenRouter key: impostare `ANTHROPIC_BASE_URL` e `ANTHROPIC_AUTH_TOKEN` nell'env
  - Restituire `(cmd_list, env_dict)`

### WebSocket Endpoint

- [x] In `app/main.py`, aggiungere l'import di `WebSocket` e `WebSocketDisconnect` da FastAPI
- [x] Creare istanza globale `pty_manager = PTYManager()`
- [x] Aggiungere evento `@app.on_event("shutdown")` che chiama `pty_manager.kill_all()`
- [x] Implementare endpoint `@app.websocket("/ws/pty/{session_id}")`:
  - Accettare la connessione WebSocket
  - Autenticare l'utente (estrarre token dalla query string `?token=`)
  - Recuperare o creare la sessione PTY
  - Avviare due task asincroni concorrenti:
    - Task A (PTY→Browser): leggere continuamente dal PTY, inviare come `{"type": "output", "data": "<base64>"}`
    - Task B (Browser→PTY): ricevere messaggi WebSocket, parsare JSON, eseguire `input`/`resize`/`ping`
  - Gestire la disconnessione: tenere il PTY vivo (la sessione persiste)

### Verifica Step 01

- [x] Avviare il server: `uvicorn app.main:app --reload --port 8000`
- [x] Verificare che non ci siano errori di import o crash
- [x] Testare il WebSocket con una pagina HTML minimale o `websocat`:
  - Connettersi a `ws://localhost:8000/ws/pty/test123`
  - Inviare `{"type": "input", "data": "echo hello\n"}`
  - Ricevere output dal PTY
- [x] Verificare che `resize` funzioni
- [x] Verificare che la chiusura della connessione WebSocket NON uccida il PTY

---

## Step 02 — Integrazione xterm.js e Tema Chiaro con Dot Grid

📄 Documentazione: `docs/02_xterm_integration_and_light_theme.md`

### Dipendenze Frontend

- [x] In `static/index.html`, aggiungere i CDN per xterm.js v5:
  - `xterm.js` core (CSS + JS)
  - `xterm-addon-fit`
  - `xterm-addon-web-links`
  - `xterm-addon-search`
- [x] Verificare che i CDN si carichino correttamente aprendo la console del browser

### Terminal Manager

- [x] Creare `static/js/terminal.js` con la classe `TerminalManager`:
  - `constructor()`: mappa di istanze Terminal per session_id
  - Definire l'oggetto tema `STREGATTO_LIGHT_THEME`:
    - `background: 'rgba(255, 255, 255, 0.88)'`
    - `foreground: '#1A1C1C'`
    - `cursor: '#FF5F1F'`
    - Tutti i 16 colori ANSI mappati sulla palette Neo-Brutalist
  - `create(sessionId, containerEl)`: crea Terminal, carica addon (fit, webLinks, search), apre nel container, fitta
  - `connect(sessionId, wsUrl)`: crea WebSocket, wira `terminal.onData` → WS send `{type: 'input'}`, WS `onmessage` → `terminal.write(base64decode(data))`, gestisce `onResize` → WS send `{type: 'resize'}`
  - `disconnect(sessionId)`: chiude WS senza distruggere il terminale
  - `destroy(sessionId)`: distrugge Terminal e chiude WS
  - `resize(sessionId)`: triggera fit addon
  - `getTerminal(sessionId)`: restituisce l'istanza
- [x] Gestire la riconnessione con backoff esponenziale (1s, 2s, 4s, 8s, max 30s)
- [x] Gestire l'encoding base64 per i dati del terminale (in e out)

### CSS Tema e Dot Grid

- [x] In `static/css/themes.css`, aggiungere le regole per il container del terminale:
  - `.terminal-container`: position relative, background dot grid (`radial-gradient(circle, #D4D4D4 1px, transparent 1px)`, `background-size: 20px 20px`), border Neo-Brutalist (`2px solid #1A1C1C`), shadow (`4px 4px 0px 0px #1A1C1C`)
  - `.terminal-container .xterm-viewport`: `background-color: rgba(255, 255, 255, 0.85) !important` per far trasparire la dot grid
- [x] Aggiungere regole CSS per il layout a 3 colonne:
  - `.app-layout`: CSS Grid con `grid-template-columns: 280px 1fr auto`
  - `.sidebar-left`: larghezza fissa 280px, `border-right: 2px solid #1A1C1C`, altezza piena
  - `.sidebar-right`: larghezza 360px, `border-left: 2px solid #1A1C1C`, collassabile
  - `.main-content`: flex column con tab bar + toolbar + terminal container
- [x] Aggiungere regole responsive:
  - `@media (max-width: 1200px)`: sidebar sinistra collassabile, sidebar destra nascosta
  - `@media (max-width: 768px)`: solo terminale full-screen, hamburger menu

### Integrazione nella SPA

- [x] In `static/index.html`, ristrutturare il layout HTML con i container per:
  - `.sidebar-left` (progetti)
  - `.main-content` > `.tab-bar` + `.toolbar` + `.terminal-container`
  - `.sidebar-right` (MCP apps)
- [x] In `static/js/app.js`, importare e inizializzare `TerminalManager`
- [x] Creare un flusso base funzionante:
  - Al caricamento della pagina, creare un terminale di test
  - Connetterlo al WebSocket `ws://localhost:8000/ws/pty/test-session`
  - L'utente deve poter digitare nel terminale e vedere output

### Verifica Step 02

- [x] Aprire `http://localhost:8000/` nel browser
- [x] Il terminale deve renderizzarsi con tema chiaro e dot grid visibile
- [x] Digitare comandi nel terminale → i caratteri appaiono (connesso al PTY dallo Step 01)
- [x] Ridimensionare la finestra del browser → il terminale si adatta automaticamente
- [x] Gli URL nell'output del terminale devono essere cliccabili
- [x] La dot grid deve essere visibile ma non invadente
- [x] I bordi e le ombre Neo-Brutalist devono essere presenti

---

## Step 03 — Modello Dati Progetti e Sessioni

📄 Documentazione: `docs/03_project_and_session_data_model.md`

### Nuovi modelli DB

- [x] Riscrivere `app/db.py` con i nuovi modelli Piccolo:
  - `ProjectDB` (tabella `stregatto_projects`): id, user_id, name, path, mode, icon, default_preset_id, pinned, created_at, updated_at
  - `SessionDB` (tabella `stregatto_sessions`): id, project_id, user_id, name, claude_session_id, preset_id, model, state, pinned, tab_order, context, created_at, updated_at, archived_at
  - `AgentPresetDB` (tabella `stregatto_agent_presets`): id, user_id, slug, name, icon, description, model, system_prompt, permission_mode, allowed_tools, mcp_servers, env_vars, is_default, created_at, updated_at
  - `UserSettingsDB` (tabella `stregatto_user_settings`): estendere con `favorite_models` (JSON), `theme` (Text), `notifications_enabled` (Boolean), `tailscale_ip` (Text), `tailscale_port` (Integer)
- [x] Mantenere `ChatDB` temporaneamente per la migrazione (non cancellarlo ancora)
- [x] Aggiornare `init_db()` per creare tutte le nuove tabelle
- [x] Aggiungere funzione `seed_default_presets(user_id)` che crea i 3 preset built-in (Stregatto, Guardian, Researcher) se non esistono

### Router Progetti

- [x] Creare `app/projects.py` con APIRouter:
  - `GET /projects`: lista progetti dell'utente (pinned first, poi per updated_at desc)
  - `GET /projects/{id}`: dettaglio progetto con conteggio sessioni
  - `POST /projects`: crea progetto (validare che il path esista se mode=local)
  - `PUT /projects/{id}`: aggiorna progetto
  - `DELETE /projects/{id}`: elimina progetto e tutte le sue sessioni

### Router Sessioni

- [x] Creare `app/sessions.py` con APIRouter:
  - `GET /projects/{project_id}/sessions`: lista sessioni (raggruppate per state: active → suspended → archived)
  - `GET /sessions/{id}`: dettaglio sessione
  - `POST /projects/{project_id}/sessions`: crea sessione (con preset_id opzionale)
  - `PUT /sessions/{id}`: aggiorna sessione (name, pinned, tab_order, state)
  - `PUT /sessions/{id}/suspend`: sospendi (kill PTY ma mantieni claude_session_id)
  - `PUT /sessions/{id}/resume`: riprendi (spawn nuovo PTY con `--resume`)
  - `PUT /sessions/{id}/archive`: archivia
  - `DELETE /sessions/{id}`: elimina permanentemente

### Router Preset

- [x] Creare `app/presets.py` con APIRouter:
  - `GET /presets`: lista preset (system + user)
  - `GET /presets/{id}`: dettaglio preset
  - `POST /presets`: crea preset custom
  - `PUT /presets/{id}`: aggiorna preset
  - `DELETE /presets/{id}`: elimina (non i system)
  - `POST /presets/seed`: seed dei preset di default

### Registrazione Router

- [x] In `app/main.py`, importare e registrare i nuovi router:
  - `app.include_router(projects_router)`
  - `app.include_router(sessions_router)`
  - `app.include_router(presets_router)`
- [x] Mantenere `chats_router` per retrocompatibilità temporanea
- [x] Nel `startup_event`, chiamare `seed_default_presets("system")` dopo `init_db()`

### Verifica Step 03

- [x] Avviare il server — nessun errore
- [x] Chiamare `GET /presets` → deve restituire i 3 preset built-in
- [x] Chiamare `POST /projects` con `{"name": "Test", "path": "C:/tmp/test", "mode": "local"}` → successo
- [x] Chiamare `POST /projects/{id}/sessions` con `{"preset_id": "..."}` → successo
- [x] Chiamare `GET /projects` → il progetto appare
- [x] Chiamare `GET /projects/{id}/sessions` → la sessione appare
- [x] Chiamare `PUT /sessions/{id}/archive` → state diventa `archived`
- [x] Chiamare `DELETE /projects/{id}` → progetto e sessioni eliminati

---

## Step 04 — Sidebar Sinistra: Navigatore Progetti

📄 Documentazione: `docs/04_left_sidebar_project_navigator.md`

### Componente Sidebar

- [x] Creare `static/js/view_projects_sidebar.js`:
  - `renderProjectsSidebar(containerEl)`: render completo della sidebar
  - `renderProjectCard(project)`: card con icona, nome, path troncato, badge mode (🟢/🔵), conteggio sessioni attive
  - `renderSearchBar()`: input di ricerca che filtra i progetti per nome
  - Event: click su progetto → seleziona e carica sessioni nella tab bar
  - Event: doppio click → apri la prima sessione attiva (o creane una nuova)
- [x] Implementare `renderNewProjectModal()`:
  - Campi: nome, path (con placeholder), modalità (locale/cloud), icona (emoji picker semplificato)
  - Bottoni: Crea / Annulla
  - Stile: modale Neo-Brutalist (border-2, shadow, sfondo bianco)
- [x] Implementare menu contestuale (click destro su progetto):
  - Modifica, Pin/Unpin, Cambia Modalità, Elimina (con conferma)
- [x] Integrare con le API: `GET /projects`, `POST /projects`, `PUT /projects/{id}`, `DELETE /projects/{id}`

### CSS Sidebar

- [x] In `themes.css`, aggiungere le regole per:
  - `.sidebar-left`: larghezza 280px, overflow-y auto, padding, border-right Neo-Brutalist
  - `.project-card`: padding, border-bottom, transizione ombra su hover
  - `.project-card.active`: border-left arancione 3px, sfondo leggermente diverso
  - `.project-card .mode-badge`: pill piccola con colore verde (locale) o blu (cloud)
  - `.search-bar`: input con stile Neo-Brutalist
  - `.new-project-btn`: bottone "+" in fondo alla sidebar
  - Animazione collapse/expand della sidebar

### Integrazione

- [x] In `app.js`, inizializzare la sidebar al caricamento
- [x] Collegare la selezione progetto al caricamento delle sessioni nella tab bar
- [x] Aggiungere shortcut `Ctrl+B` per toggle sidebar
- [x] La sidebar deve mostrare i progetti pinnati prima, poi gli altri per data

### Verifica Step 04

- [x] La sidebar mostra i progetti dell'utente
- [x] Click su un progetto lo seleziona (highlight arancione)
- [x] Il bottone "+" apre il modale di creazione progetto
- [x] Il modale crea il progetto e la sidebar si aggiorna
- [x] Click destro apre il menu contestuale
- [x] Pin/Unpin funziona (il progetto pinnato va in cima)
- [x] La ricerca filtra i progetti
- [x] `Ctrl+B` togla/mostra la sidebar

---

## Step 05 — Tab Bar: Gestione Sessioni

📄 Documentazione: `docs/05_tab_bar_session_management.md`

### Componente Tab Bar

- [x] Creare `static/js/view_tab_bar.js` con la classe `TabBar`:
  - `constructor(containerEl)`: setup iniziale
  - `renderTabs(sessions)`: render di tutte le tab per il progetto selezionato
  - `renderTab(session)`: singola tab con nome, badge modello, badge mode, pulsante chiudi (✕)
  - `activateTab(sessionId)`: switch tab attiva, mostrare/nascondere terminali
  - `closeTab(sessionId)`: chiudere tab (prompt: Sospendi o Elimina?)
  - `addTab(session)`: aggiungere nuova tab
- [x] Implementare il bottone "+" alla fine delle tab:
  - Click → mostra un picker rapido dei preset (mini Agent Gallery inline)
  - Seleziona preset → crea sessione via API → spawn PTY → apri tab
- [x] Implementare menu contestuale su tab (click destro):
  - Rinomina, Pin 📌 / Unpin, Sospendi ⏸, Archivia 📦, Chiudi ✕
- [x] Implementare dropdown sessioni archiviate:
  - Bottone `📦 Archiviate (N)` visibile solo se ci sono sessioni archiviate
  - Click → dropdown con lista. Click su una → riprendi (`PUT /sessions/{id}/resume`)
- [x] Implementare drag & drop per riordinare le tab

### Multi-Terminal Management

- [x] Ogni sessione ha la propria istanza `Terminal` (xterm.js) e il proprio WebSocket
- [x] Solo la tab attiva è visibile (`display: block`), le altre sono nascoste (`display: none`)
- [x] Quando si switcha tab, chiamare `terminal.refresh()` per sincronizzare il display
- [x] Il WebSocket delle tab in background resta aperto (il PTY continua a funzionare)

### CSS Tab Bar

- [x] In `themes.css`, aggiungere le regole per:
  - `.tab-bar`: container orizzontale scrollabile, border-bottom Neo-Brutalist, altezza 40px
  - `.tab`: inline-flex, border Neo-Brutalist, padding 8px 16px, transizione ombra
  - `.tab.active`: border-bottom arancione 3px, ombra elevata
  - `.tab.pinned`: icona 📌 visibile
  - `.tab .close-btn`: ✕, visibile solo su hover
  - `.tab .model-badge`: testo piccolo grigio con nome modello
  - `.new-session-btn`: bottone "+" alla fine
  - `.archived-dropdown`: dropdown posizionato sotto il bottone 📦
  - Indicatori di scroll (fade) ai bordi se le tab overflowano

### Integrazione con PTY

- [x] Quando si crea una nuova sessione (bottone "+"):
  1. `POST /projects/{id}/sessions` con `preset_id`
  2. Connettere `TerminalManager.create(sessionId, containerEl)`
  3. Connettere `TerminalManager.connect(sessionId, wsUrl)`
  4. Il WebSocket endpoint spawna il PTY se non esiste
- [x] Quando si chiude una tab con "Sospendi":
  1. `PUT /sessions/{id}/suspend` → backend uccide il PTY
  2. `TerminalManager.destroy(sessionId)`
  3. La sessione resta nel DB come `suspended`
- [x] Quando si riprende una sessione archiviata/sospesa:
  1. `PUT /sessions/{id}/resume`
  2. Backend spawna nuovo PTY con `claude --resume <claude_session_id>`
  3. Frontend crea nuovo Terminal e lo connette

### Verifica Step 05

- [x] Le tab appaiono per il progetto selezionato nella sidebar
- [x] Click su una tab switcha il terminale visibile
- [x] Il bottone "+" crea una nuova sessione e apre un nuovo terminale
- [x] Click destro su tab mostra il menu contestuale
- [x] "Sospendi" chiude il terminale ma la sessione resta nell'elenco come sospesa
- [x] "Riprendi" su una sessione sospesa riapre un terminale con `--resume`
- [x] "Archivia" sposta la sessione nel dropdown archiviate
- [x] Drag & drop riordina le tab
- [x] Sessioni pinnate restano sempre a sinistra

---

## Step 06 — Agent Gallery e Toolbar

📄 Documentazione: `docs/06_agent_gallery_and_toolbar.md`

### Agent Gallery

- [x] Creare `static/js/view_agent_gallery.js`:
  - `AgentGallery.render(containerEl)`: griglia di card preset (3 colonne desktop, 2 tablet, 1 mobile)
  - `AgentGallery.renderPresetCard(preset)`: card con icona, nome, descrizione, modello, permessi, riassunto tool
  - Hover: ombra shift da `4px 4px #1A1C1C` a `2px 2px #FF5F1F`
  - Click su "Avvia": seleziona preset e crea nuova sessione nel progetto attivo
- [x] Implementare form creazione/modifica preset:
  - Nome, Icona (selettore emoji), Descrizione
  - Modello (dropdown dai modelli disponibili via `GET /llms`)
  - System Prompt (textarea)
  - Permission Mode (radio: plan/auto/acceptEdits/bypassPermissions)
  - Allowed Tools (checkbox: Read, Write, Edit, Bash, Grep, Glob, WebFetch, etc.)
  - MCP Servers (checkbox list)
  - Bottoni: Salva / Annulla / Elimina (se editing)
- [x] Integrare con le API: `GET /presets`, `POST /presets`, `PUT /presets/{id}`, `DELETE /presets/{id}`

### Floating Toolbar

- [x] Creare `static/js/view_toolbar.js`:
  - `Toolbar.render(containerEl, session)`: render toolbar per la sessione attiva
  - `Toolbar.renderModelSelector(currentModel)`:
    - Dropdown con modelli preferiti dell'utente (`UserSettingsDB.favorite_models`)
    - On change: invia `/model <model_id>` nel PTY stdin via WebSocket
    - Aggiorna `session.model` nel DB via `PUT /sessions/{id}`
  - `Toolbar.renderAttachButton()`:
    - Click → file picker nativo
    - Upload file a `POST /uploads`
    - Mostra chip con preview (thumbnail per immagini, icona per altri file)
  - `Toolbar.renderAttachmentChips(files)`:
    - Chip per ogni file allegato con nome + ✕ per rimuovere
    - Quando l'utente digita nel terminale, i path dei file allegati sono disponibili
  - `Toolbar.renderPresetIndicator(preset)`:
    - Mostra icona + nome del preset attivo
    - Click → apre Agent Gallery
  - `Toolbar.renderStopButton()`:
    - Bottone rosso, invia segnale kill al PTY
  - `Toolbar.renderConnectionStatus()`:
    - 🟢 connesso, 🔴 disconnesso, 🟡 riconnessione

### CSS Toolbar e Gallery

- [x] In `themes.css`, aggiungere:
  - `.toolbar`: altezza 48px, border-bottom Neo-Brutalist, background bianco, flex row, align-items center
  - `.toolbar .model-selector`: dropdown Neo-Brutalist (border-2, no border-radius)
  - `.toolbar .attach-btn`: bottone icona 📎
  - `.toolbar .attachment-chip`: inline-flex, border, border-radius 0, background #F5F5F5
  - `.toolbar .stop-btn`: sfondo rosso, testo bianco, border-2 nero
  - `.toolbar .connection-status`: pallino colorato con animazione pulse per 🟡
  - `.agent-gallery`: griglia CSS con gap 16px
  - `.preset-card`: border-2, shadow, padding, transizione hover
  - `.preset-form`: form con campi Neo-Brutalist

### Flusso File Attachment

- [x] Implementare drag & drop sulla zona terminale:
  - Intercettare `dragover` e `drop` sul container del terminale (non su xterm direttamente)
  - Upload automatico e aggiunta chip nella toolbar
- [x] Implementare paste immagine (`Ctrl+V`):
  - Intercettare l'evento paste, controllare se ci sono immagini nel clipboard
  - Upload automatico e aggiunta chip
- [x] Quando l'utente vuole inviare con allegati:
  - Bottone "📎 Invia con allegati" nella toolbar che scrive i path nel terminale
  - Oppure: un meccanismo che inietta i path nel PTY stdin preceduti da un prompt

### Verifica Step 06

- [x] La toolbar appare sopra il terminale con tutti i controlli
- [x] Il model selector mostra i modelli preferiti e li cambia nel terminale
- [x] Il bottone attach apre il file picker e mostra i chip
- [x] Drag & drop di file sulla zona terminale funziona
- [x] Il bottone stop ferma il PTY
- [x] L'indicatore di connessione mostra lo stato corretto
- [x] L'Agent Gallery mostra i preset in una griglia
- [x] Click "Avvia" su un preset crea una nuova sessione
- [x] Il form di creazione preset funziona e salva nel DB

---

## Step 07 — Sidebar Destra: Pannello MCP Apps

📄 Documentazione: `docs/07_right_sidebar_mcp_apps.md`

### Backend MCP Apps

- [x] Creare `app/mcp_apps.py` con APIRouter:
  - `GET /mcp/apps`: lista delle MCP App disponibili dai server configurati
  - `GET /mcp/apps/{app_id}/proxy`: proxy per richieste verso MCP app server (CORS)
  - `GET /mcp/config`: leggere configurazione MCP
  - `PUT /mcp/config`: aggiornare configurazione MCP
- [x] Registrare il router in `app/main.py`

### Frontend MCP Sidebar

- [x] Creare `static/js/view_mcp_sidebar.js`:
  - `McpSidebar.render(containerEl)`: render sidebar con lista app e container iframe
  - `McpSidebar.renderAppList(apps)`: lista delle app disponibili con icone
  - `McpSidebar.renderAppFrame(app)`: creare iframe sandboxato (`sandbox="allow-scripts allow-forms allow-same-origin"`)
  - `McpSidebar.openApp(appId)`: caricare app nell'iframe
  - `McpSidebar.closeApp(appId)`: rimuovere iframe
  - `McpSidebar.toggleSidebar()`: toggle visibilità con animazione
- [x] Implementare protocollo postMessage per comunicazione iframe ↔ host:
  - App → Host: `{type: 'mcp-app-request', action, data}`
  - Host → App: `{type: 'mcp-app-context', data: {sessionId, projectPath, theme}}`
- [x] Aggiungere listener `window.addEventListener('message', handler)` per i messaggi dalle app

### CSS Sidebar Destra

- [x] In `themes.css`, aggiungere:
  - `.sidebar-right`: larghezza 360px, border-left Neo-Brutalist, overflow-y auto
  - `.mcp-app-frame`: iframe con border Neo-Brutalist, larghezza 100%, altezza variabile
  - `.mcp-app-list`: lista verticale con icone/nomi delle app
  - `.sidebar-right.collapsed`: larghezza 0, overflow hidden, transizione
  - Bottone toggle (freccia) posizionato sul bordo

### Integrazione Layout

- [x] Aggiornare il CSS Grid principale per supportare il layout a 3 colonne con entrambe le sidebar collassabili
- [x] Aggiungere shortcut `Ctrl+E` per toggle sidebar destra
- [x] Il terminale al centro deve espandersi quando le sidebar si collassano

### Verifica Step 07

- [x] La sidebar destra appare con la lista delle MCP app (anche se vuota inizialmente)
- [x] `Ctrl+E` togla/mostra la sidebar
- [x] Se ci sono app MCP configurate, gli iframe si caricano correttamente
- [x] Il postMessage funziona tra iframe e host
- [x] Il layout si adatta quando le sidebar si aprono/chiudono
- [x] Il terminale si ridimensiona automaticamente

---

## Step Finale — Pulizia e Consolidamento

### Rimozione codice deprecato

- [x] Eliminare `app/bridge.py` (sostituito da `app/pty_manager.py`)
- [x] Eliminare `app/chats.py` (sostituito da `app/projects.py` + `app/sessions.py`)
- [x] Rimuovere la tabella `ChatDB` da `app/db.py` (e la migrazione corrispondente)
- [x] Rimuovere l'import di `run_claude_stream` e `cancel_session_process` da `app/main.py`
- [x] Rimuovere l'import del vecchio `chats_router` da `app/main.py`
- [x] Rimuovere tutte le rotte legacy che usavano il bridge SSE:
  - `POST /agents/{agent_slug}/message` (basato su SSE) — sostituito da WebSocket
  - `POST /agents/{agent_slug}/cancel` — sostituito da `PTYManager.kill()`
- [x] Pulire `static/js/view_chat.js`: rimuovere tutto il codice SSE/NDJSON (o eliminare il file se completamente sostituito)

### Verifica finale

- [x] L'applicazione si avvia senza errori
- [x] Nessun import rotto o modulo mancante
- [x] È possibile: creare progetto → creare sessione con preset → interagire nel terminale → sospendere → riprendere → archiviare
- [x] Le sidebar si aprono/chiudono correttamente
- [x] Il model selector funziona
- [x] I file si allegano e i path sono utilizzabili
- [x] La dot grid è visibile nel terminale
- [x] I bordi e le ombre Neo-Brutalist sono coerenti in tutta l'app
- [x] Nessun file deprecato è ancora presente nel progetto


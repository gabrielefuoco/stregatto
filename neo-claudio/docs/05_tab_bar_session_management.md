# Step 05 — Tab Bar: Gestione Sessioni

## 1. Obiettivo
La Tab Bar si posiziona sopra l'area del terminale e gestisce molteplici sessioni per il progetto correntemente selezionato.
- Ogni tab mostra: nome della sessione, un badge per la modalità, il modello AI in uso e un pulsante per chiudere.
- **Stati della Tab:**
  - *Active:* Il terminale associato è visibile (`display: block`).
  - *Background:* Il terminale è nascosto, ma il WebSocket (e la PTY) restano attivi. Il buffer accumula output.
  - *Pinned:* Tab fissato con icona 📌 (non può essere chiuso accidentalmente senza togliere il pin).
- **Azioni:**
  - Click sinistro per switchare tab.
  - Click con rotellina (middle-click) per chiudere.
  - Drag and drop per riordinare.
  - Click destro per un Context Menu: Rinomina, Pin/Unpin, Sospendi (Suspend), Archivia, Chiudi/Uccidi (Kill PTY).
- Pulsante "+ Nuova Sessione" a destra per scegliere un preset e avviare un nuovo agente.
- Menu a tendina per accedere alle sessioni Archiviate: `📦 Archiviate (N)`.
- Ottimizzazione Multi-Terminal: sincronizzazione automatica della vista quando una tab in background torna attiva (`terminal.refresh()`).

## 2. File: static/js/view_tab_bar.js (NEW)

Implementazione dettagliata della classe `TabBar`:

```javascript
/**
 * static/js/view_tab_bar.js
 * Componente Tab Bar per gestire i terminali xterm.js con stile Neo-Brutalist
 */

class TabBar {
    constructor(containerEl, app) {
        this.container = containerEl;
        this.app = app;
        this.sessions = [];
        this.activeSessionId = null;
        this.initShell();
    }

    initShell() {
        this.container.innerHTML = `
            <div class="tab-bar-wrapper flex border-b-2 border-black bg-gray-100">
                <div id="tabs-container" class="flex-1 flex overflow-x-auto no-scrollbar items-end pt-2 px-2 gap-1">
                    <!-- Tabs go here -->
                </div>
                <div class="tab-bar-actions flex items-center px-2 gap-2 border-l-2 border-black bg-white">
                    <button id="btn-archived" class="neo-btn-icon hover:bg-gray-200 p-2 font-bold text-sm" title="Sessioni Archiviate">
                        📦 <span id="archived-count">0</span>
                    </button>
                    <button id="btn-new-session" class="neo-btn bg-black text-white px-3 py-1 font-bold hover:-translate-y-1 hover:shadow-[2px_2px_0px_#FF5F1F] transition-all">
                        +
                    </button>
                </div>
            </div>
        `;

        this.container.querySelector('#btn-new-session').addEventListener('click', () => {
            this.renderNewSessionPicker();
        });
        
        this.container.querySelector('#tabs-container').addEventListener('contextmenu', (e) => {
            const tab = e.target.closest('.tab-item');
            if (tab) {
                e.preventDefault();
                const session = this.sessions.find(s => s.id === tab.dataset.id);
                if (session) this.renderContextMenu(session, e);
            }
        });
    }

    loadSessions(sessionsData) {
        this.sessions = sessionsData;
        this.renderTabs();
        if (this.sessions.length > 0) {
            this.activateTab(this.sessions[0].id);
        } else {
            // Gestione stato vuoto
            this.app.clearTerminalArea();
        }
    }

    renderTabs() {
        const tabsContainer = this.container.querySelector('#tabs-container');
        tabsContainer.innerHTML = '';
        
        // Ordina mettendo le Pinned prima
        const sorted = [...this.sessions].sort((a, b) => {
            if (a.is_pinned === b.is_pinned) return 0;
            return a.is_pinned ? -1 : 1;
        });

        sorted.forEach(session => {
            tabsContainer.appendChild(this.createTabElement(session));
        });
    }

    createTabElement(session) {
        const tab = document.createElement('div');
        tab.className = `tab-item flex items-center gap-2 px-3 py-2 border-2 border-black border-b-0 rounded-t-lg bg-white cursor-pointer select-none transition-all group max-w-[200px] ${session.id === this.activeSessionId ? 'active bg-[#FF5F1F] text-white shadow-[0_-2px_0px_rgba(0,0,0,1)]' : 'hover:bg-gray-50'}`;
        tab.dataset.id = session.id;

        tab.innerHTML = `
            ${session.is_pinned ? '<span class="text-xs">📌</span>' : ''}
            <div class="flex-1 min-w-0 flex flex-col">
                <span class="font-bold truncate text-sm leading-tight">${session.name}</span>
                <span class="model-badge text-[10px] font-mono opacity-80 truncate uppercase">${session.model || 'CLAUDE 3.5'}</span>
            </div>
            ${!session.is_pinned ? `
                <button class="close-btn neo-btn-icon opacity-0 group-hover:opacity-100 hover:text-red-500 font-bold ml-1">✕</button>
            ` : ''}
        `;

        // Left click
        tab.addEventListener('click', (e) => {
            if (e.target.closest('.close-btn')) {
                this.closeTab(session.id);
                return;
            }
            this.activateTab(session.id);
        });

        // Middle click to close
        tab.addEventListener('auxclick', (e) => {
            if (e.button === 1 && !session.is_pinned) {
                e.preventDefault();
                this.closeTab(session.id);
            }
        });

        return tab;
    }

    activateTab(sessionId) {
        this.activeSessionId = sessionId;
        this.renderTabs();
        
        // Segnala all'App di switchare il terminale visibile
        this.app.switchActiveTerminal(sessionId);
    }

    async closeTab(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;

        // Richiesta di conferma per Kill o Suspend
        const action = confirm(`Sospendere o Uccidere la sessione "${session.name}"?\nOK = Kill (Distrugge il processo)\nCancel = Suspend (Mantiene lo stato)`);
        
        try {
            if (action) {
                await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
            } else {
                await fetch(`/api/sessions/${sessionId}/suspend`, { method: 'PUT' });
            }
            
            this.sessions = this.sessions.filter(s => s.id !== sessionId);
            if (this.activeSessionId === sessionId) {
                this.activeSessionId = this.sessions.length > 0 ? this.sessions[this.sessions.length - 1].id : null;
            }
            
            this.renderTabs();
            if (this.activeSessionId) {
                this.app.switchActiveTerminal(this.activeSessionId);
            } else {
                this.app.clearTerminalArea();
            }

        } catch (err) {
            console.error("Failed to close session", err);
        }
    }

    renderContextMenu(session, event) {
        // Simile al context menu della sidebar...
        const oldMenu = document.getElementById('tab-context-menu');
        if (oldMenu) oldMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'tab-context-menu';
        menu.className = 'fixed bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] z-50 flex flex-col py-1 min-w-[150px]';
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;

        const menuItems = [
            { label: 'Rinomina', action: () => {/* */} },
            { label: session.is_pinned ? 'Rimuovi Pin' : 'Fissa (Pin)', action: () => {/* */} },
            { label: 'Archivia', action: () => {/* PUT /archive */} },
            { label: 'Chiudi (Kill)', action: () => this.closeTab(session.id), danger: true }
        ];

        menuItems.forEach(item => {
            const btn = document.createElement('button');
            btn.className = `text-left px-4 py-2 text-sm hover:bg-gray-100 font-bold ${item.danger ? 'text-red-600' : ''}`;
            btn.innerText = item.label;
            btn.addEventListener('click', () => { item.action(); menu.remove(); });
            menu.appendChild(btn);
        });

        document.body.appendChild(menu);
        setTimeout(() => document.addEventListener('click', () => menu.remove(), {once: true}), 0);
    }

    renderNewSessionPicker() {
        // Apre un modal o popover per scegliere il preset
        console.log("Opening new session preset picker...");
        // Integrazione: chiamata API POST /projects/{project_id}/sessions
    }
}
```

## 3. File: static/css/themes.css (MODIFIED)

Regole CSS per la Tab Bar Neo-Brutalist:

```css
/* Tab Bar Container */
.tab-bar-wrapper {
    height: 48px; /* Fixed height per coerenza layout */
}

/* Tab Items */
.tab-item {
    margin-bottom: -2px; /* Sovrappone il border bottom del container */
    transition: background-color 0.2s, color 0.2s;
}

.tab-item.active {
    border-bottom: 2px solid #FF5F1F;
}

/* Nasconde scrollbar default ma mantiene scrollabilità */
.no-scrollbar::-webkit-scrollbar {
    display: none;
}
.no-scrollbar {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
}

/* Close Button Animation */
.tab-item .close-btn {
    transition: transform 0.1s;
}
.tab-item .close-btn:hover {
    transform: scale(1.2);
}
```

## 4. Multi-Terminal Instance Management

La vera sfida tecnica del front-end risiede nel gestire multipli terminali contemporaneamente. 
In `app.js` (o in una classe `TerminalManager` dedicata):

1. **Dizionario dei Terminali:** Manteniamo una mappa `activeTerminals = { [sessionId]: xtermInstance }`.
2. **WebSocket per Sessione:** Ogni PTY ha il suo WebSocket. Il WS resta aperto in background; quando riceve dati per un tab in background, scrive sul buffer nascosto dell'istanza `xterm` corrispondente.
3. **Switching e Reflow:**
```javascript
switchActiveTerminal(sessionId) {
    // 1. Nascondi tutti i container dei terminali
    document.querySelectorAll('.terminal-container').forEach(el => el.style.display = 'none');
    
    // 2. Mostra quello richiesto
    const targetEl = document.getElementById(`term-${sessionId}`);
    if (targetEl) {
        targetEl.style.display = 'block';
        // 3. CRITICO: Forza il resize di xterm.js per calcolare i corretti cols/rows
        // Dato che era hidden (display: none), le dimensioni erano zero.
        this.activeTerminals[sessionId].fitAddon.fit();
        
        // 4. Se si usa il plugin webgl, potrebbe servire forzare il refresh
        this.activeTerminals[sessionId].refresh(0, this.activeTerminals[sessionId].rows - 1);
        this.activeTerminals[sessionId].focus();
    }
}
```
4. **Memory Optimization:** Se l'utente apre più di 10 tab, distruggere (dispose) l'istanza `xterm.js` meno usata e salvare solo lo stato/storico testuale. Al ritorno sul tab, ricreare l'istanza xterm facendo un replay dello storico.

## 5. Session Lifecycle Integration

Flusso API associato alle azioni sulla Tab Bar:
- **Nuova Sessione:** `POST /projects/{id}/sessions` passando il `preset_id` scelto. Il server spawna un sub-process, assegna una PTY e ritorna la sessione. Si apre un nuovo tab e si connette il WebSocket.
- **Chiudi (Kill):** `DELETE /api/sessions/{id}`. Il server manda un `SIGKILL` al processo. La connessione WS si chiude e il tab viene rimosso.
- **Sospendi (Suspend):** `PUT /api/sessions/{id}/suspend`. Manda in pausa o stacca la vista senza uccidere il processo se supportato, altrimenti mantiene viva la PTY ma libera memoria dal client.
- **Archivia:** `PUT /api/sessions/{id}/archive`. Sposta il tab nella lista archiviata (visibile via dropdown).

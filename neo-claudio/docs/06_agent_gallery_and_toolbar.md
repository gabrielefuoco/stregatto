# Step 06 — Agent Gallery e Toolbar

Questo documento descrive l'implementazione della **Agent Gallery** (una griglia visuale per la selezione e gestione dei preset di Claude Code) e della **Floating Toolbar** (una barra degli strumenti posizionata sopra il terminale per controllare la sessione attiva).

## 1. Obiettivo

- **Agent Gallery**: Fornire all'utente un'interfaccia a griglia (o lista) per selezionare un preset (agent) durante la creazione di una nuova sessione.
- Ogni card del preset mostra: icona, nome, descrizione, modello, permission mode e un riepilogo dei tool consentiti.
- Supporto per creare, modificare e cancellare preset customizzati.
- **Floating Toolbar**: Una barra posizionata direttamente sopra il terminale che offre: selettore del modello, pulsante per gli allegati (file attach), indicatore del preset corrente, pulsante di stop per interrompere la generazione/esecuzione e lo stato della connessione WebSocket.

---

## 2. Agent Gallery — File: `static/js/view_agent_gallery.js` (NEW)

L'Agent Gallery gestisce sia la visualizzazione delle card dei preset (con un layout responsive CSS Grid) sia il form per crearne di nuovi, adottando lo stile Neo-Brutalist (bordi spessi, ombre nette, hover states marcati con accento arancione).

```javascript
// static/js/view_agent_gallery.js

export class AgentGallery {
    constructor(apiClient, router) {
        this.api = apiClient;
        this.router = router;
        this.presets = [];
    }

    async render(containerEl) {
        containerEl.innerHTML = '<div class="p-4">Caricamento agenti in corso...</div>';
        try {
            // Recupero presets dal backend
            this.presets = await this.api.get('/presets');
            
            let html = `
                <div class="agent-gallery-container p-6 w-full max-w-7xl mx-auto">
                    <div class="flex justify-between items-center mb-8">
                        <h2 class="text-3xl font-bold font-mono tracking-tight uppercase">Agent Gallery</h2>
                        <button id="btn-create-preset" class="neo-btn bg-[#FF5F1F] text-white px-4 py-2 font-bold font-mono">
                            + Nuovo Agent
                        </button>
                    </div>
                    
                    <div class="agent-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        ${this.presets.map(p => this.renderPresetCard(p)).join('')}
                    </div>
                    
                    <div id="preset-form-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <!-- Form injected here via JS -->
                    </div>
                </div>
            `;
            containerEl.innerHTML = html;
            this.bindEvents(containerEl);
        } catch (error) {
            containerEl.innerHTML = `<div class="p-4 text-red-600 font-bold border-2 border-red-600 bg-red-100">Errore: ${error.message}</div>`;
        }
    }

    renderPresetCard(preset) {
        // Neo-Brutalist styling: border-2, sharp corners, hard shadow
        return `
            <div class="preset-card neo-panel flex flex-col bg-white p-5 cursor-pointer transition-transform relative group" data-id="${preset.id}">
                <div class="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="btn-delete-preset bg-white border-2 border-black w-8 h-8 flex items-center justify-center hover:bg-red-500 hover:text-white" data-id="${preset.id}" title="Elimina">✕</button>
                </div>
                
                <div class="flex items-center gap-4 mb-4">
                    <div class="text-4xl bg-yellow-100 border-2 border-black w-16 h-16 flex items-center justify-center shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                        ${preset.icon || '🤖'}
                    </div>
                    <div>
                        <h3 class="text-xl font-bold font-mono uppercase">${preset.name}</h3>
                        <span class="text-xs bg-gray-200 border border-black px-1 font-mono">${preset.model || 'Auto'}</span>
                    </div>
                </div>
                <p class="text-sm flex-grow mb-4 font-sans text-gray-700">${preset.description}</p>
                <div class="flex gap-2 flex-wrap text-xs font-mono mt-auto pt-4 border-t-2 border-black">
                    <span class="bg-[#FF5F1F] text-white px-2 py-1 uppercase">${preset.permission_mode}</span>
                    <span class="bg-blue-100 border border-black px-2 py-1">${preset.allowed_tools.length} Tools</span>
                </div>
            </div>
        `;
    }

    renderCreatePresetForm() {
        return `
            <div class="neo-panel bg-white p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
                <button id="btn-close-modal" class="absolute top-4 right-4 font-bold text-xl hover:text-[#FF5F1F]">✕</button>
                <h3 class="text-2xl font-bold font-mono mb-6 uppercase border-b-4 border-black pb-2">Crea Nuovo Agent</h3>
                
                <form id="create-preset-form" class="flex flex-col gap-4 font-mono text-sm">
                    <div class="flex gap-4">
                        <div class="flex flex-col gap-1 w-20">
                            <label class="font-bold uppercase">Icona</label>
                            <input type="text" name="icon" class="neo-input text-center text-2xl" value="🤖" required>
                        </div>
                        <div class="flex flex-col gap-1 flex-grow">
                            <label class="font-bold uppercase">Nome</label>
                            <input type="text" name="name" class="neo-input" placeholder="Es. React Developer" required>
                        </div>
                    </div>
                    
                    <div class="flex flex-col gap-1">
                        <label class="font-bold uppercase">Descrizione</label>
                        <input type="text" name="description" class="neo-input" placeholder="Descrizione breve...">
                    </div>
                    
                    <div class="flex flex-col gap-1">
                        <label class="font-bold uppercase">Modello LLM</label>
                        <select name="model" class="neo-input bg-white cursor-pointer">
                            <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Consigliato)</option>
                            <option value="claude-3-opus">Claude 3 Opus</option>
                            <option value="gpt-4o">GPT-4o</option>
                        </select>
                    </div>
                    
                    <div class="flex flex-col gap-1">
                        <label class="font-bold uppercase">System Prompt</label>
                        <textarea name="system_prompt" class="neo-input h-32 resize-y" placeholder="Istruzioni personalizzate per l'agente..."></textarea>
                    </div>
                    
                    <div class="flex flex-col gap-2">
                        <label class="font-bold uppercase">Permission Mode</label>
                        <div class="flex gap-4 bg-gray-100 p-2 border-2 border-black">
                            <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="permission_mode" value="plan" checked> Plan</label>
                            <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="permission_mode" value="auto"> Auto</label>
                            <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="permission_mode" value="acceptEdits"> Accept Edits</label>
                            <label class="flex items-center gap-2 text-red-600 font-bold cursor-pointer"><input type="radio" name="permission_mode" value="bypassPermissions"> Bypass (Pericoloso)</label>
                        </div>
                    </div>
                    
                    <div class="flex flex-col gap-2">
                        <label class="font-bold uppercase">Tool Consentiti</label>
                        <div class="grid grid-cols-3 gap-2 border-2 border-black p-3 bg-yellow-50">
                            <label><input type="checkbox" name="tools" value="Read" checked> Read</label>
                            <label><input type="checkbox" name="tools" value="Write" checked> Write</label>
                            <label><input type="checkbox" name="tools" value="Edit" checked> Edit</label>
                            <label><input type="checkbox" name="tools" value="Bash" checked> Bash</label>
                            <label><input type="checkbox" name="tools" value="WebFetch"> WebFetch</label>
                            <label><input type="checkbox" name="tools" value="Glob" checked> Glob/Grep</label>
                        </div>
                    </div>
                    
                    <button type="submit" class="neo-btn bg-[#FF5F1F] text-white py-3 mt-4 text-lg font-bold uppercase hover:bg-black">Salva Agent</button>
                </form>
            </div>
        `;
    }

    bindEvents(containerEl) {
        // Apri form creazione
        containerEl.querySelector('#btn-create-preset').addEventListener('click', () => {
            const modal = containerEl.querySelector('#preset-form-modal');
            modal.innerHTML = this.renderCreatePresetForm();
            modal.classList.remove('hidden');
            
            modal.querySelector('#btn-close-modal').addEventListener('click', () => {
                modal.classList.add('hidden');
            });

            modal.querySelector('#create-preset-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                // Costruzione payload ed invio POST...
                // Ricarica la galleria dopo il successo
            });
        });

        // Click sulle card -> Seleziona e vai
        containerEl.querySelectorAll('.preset-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-delete-preset')) return; // ignora se click su elimina
                const presetId = card.dataset.id;
                this.selectPreset(presetId);
            });
        });

        // Elimina preset
        containerEl.querySelectorAll('.btn-delete-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const presetId = e.currentTarget.dataset.id;
                this.deletePreset(presetId);
            });
        });
    }

    selectPreset(presetId) {
        // Logica per avviare una sessione con questo preset per il progetto corrente
        console.log(`Avvio sessione con preset: ${presetId}`);
        // ... chiamata backend POST /sessions { preset_id: presetId, project_id: currentProject }
        // ... redirect alla view del terminale
    }

    async deletePreset(presetId) {
        if(confirm("Sei sicuro di voler eliminare questo Agent?")) {
            await this.api.delete(`/presets/${presetId}`);
            this.render(document.querySelector('#main-content')); // refresh
        }
    }
}
```

---

## 3. Floating Toolbar — File: `static/js/view_toolbar.js` (NEW)

La Toolbar viene agganciata al container principale della sessione, appena sopra l'istanza di `TerminalView`. Gestisce l'interazione rapida senza dover digitare comandi da tastiera.

```javascript
// static/js/view_toolbar.js

export class Toolbar {
    constructor(session, wsClient) {
        this.session = session;
        this.wsClient = wsClient; // WebSocketClient instance per dialogare con la PTY
        this.attachments = []; // Lista locale di percorsi file allegati
    }

    render(containerEl) {
        const toolbarHtml = `
            <div class="toolbar-container h-12 flex items-center justify-between px-4 border-b-4 border-black bg-white font-mono text-sm z-10 shrink-0">
                <div class="flex items-center gap-4">
                    ${this.renderPresetIndicator()}
                    <div class="w-px h-6 bg-black"></div>
                    ${this.renderModelSelector()}
                    <div class="w-px h-6 bg-black"></div>
                    ${this.renderAttachButton()}
                </div>
                
                <div id="attachment-chips-container" class="flex flex-1 items-center gap-2 overflow-x-auto px-4">
                    <!-- Chips allegati renderizzati qui -->
                </div>
                
                <div class="flex items-center gap-4">
                    ${this.renderConnectionStatus()}
                    ${this.renderStopButton()}
                </div>
            </div>
            <!-- Hidden File Input for attach -->
            <input type="file" id="hidden-file-input" class="hidden" multiple>
        `;
        
        containerEl.innerHTML = toolbarHtml;
        this.bindEvents(containerEl);
    }

    renderPresetIndicator() {
        const p = this.session.preset || { icon: '🤖', name: 'Default' };
        return `
            <div class="flex items-center gap-2 cursor-pointer hover:text-[#FF5F1F]" title="Cambia Preset">
                <span class="text-xl">${p.icon}</span>
                <span class="font-bold uppercase">${p.name}</span>
            </div>
        `;
    }

    renderModelSelector() {
        // La lista dei modelli idealmente proviene da UserSettingsDB.favorite_models
        const models = ['claude-3-5-sonnet', 'claude-3-opus', 'gpt-4o'];
        const current = this.session.model || models[0];
        
        return `
            <select id="toolbar-model-select" class="neo-input h-8 py-0 px-2 bg-yellow-50 cursor-pointer text-xs uppercase font-bold border-2">
                ${models.map(m => `<option value="${m}" ${m === current ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
        `;
    }

    renderAttachButton() {
        return `
            <button id="toolbar-btn-attach" class="flex items-center gap-1 hover:text-[#FF5F1F] font-bold transition-colors">
                <span>📎</span> <span>Allega</span>
            </button>
        `;
    }

    renderStopButton() {
        return `
            <button id="toolbar-btn-stop" class="bg-red-500 text-white border-2 border-black font-bold uppercase px-3 py-1 hover:bg-black shadow-[2px_2px_0px_#000] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all flex items-center gap-1">
                <span class="block w-2 h-2 bg-white rounded-sm"></span> Stop
            </button>
        `;
    }

    renderConnectionStatus() {
        return `
            <div id="ws-status-indicator" class="flex items-center gap-2 text-xs font-bold">
                <span class="status-dot w-3 h-3 rounded-full bg-green-500 border border-black inline-block animate-pulse"></span>
                <span>Connesso</span>
            </div>
        `;
    }

    renderAttachmentChips() {
        const container = document.getElementById('attachment-chips-container');
        if (!container) return;
        
        container.innerHTML = this.attachments.map((file, idx) => `
            <div class="flex items-center gap-1 bg-blue-100 border-2 border-black px-2 py-0.5 text-xs whitespace-nowrap shadow-[1px_1px_0px_#000]">
                <span>📎 ${file.name}</span>
                <button class="btn-remove-attachment hover:text-red-600 font-bold ml-1" data-idx="${idx}">✕</button>
            </div>
        `).join('');

        // Bind events for removing attachments
        container.querySelectorAll('.btn-remove-attachment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx, 10);
                this.attachments.splice(idx, 1);
                this.renderAttachmentChips();
            });
        });
    }

    bindEvents(containerEl) {
        // Model change flow
        const modelSelect = containerEl.querySelector('#toolbar-model-select');
        modelSelect.addEventListener('change', (e) => {
            const newModel = e.target.value;
            // Invio del comando speciale /model alla PTY
            this.wsClient.sendData(`/model ${newModel}\n`);
            // Aggiornamento database opzionale in background...
        });

        // Attach Button flow
        const fileInput = containerEl.querySelector('#hidden-file-input');
        containerEl.querySelector('#toolbar-btn-attach').addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            // 1. Upload al backend (POST /uploads -> salvataggio in workspace/.attachments)
            // 2. Aggiunta alla lista locale
            for (let f of files) {
                // Mock per UI: assumiamo che il caricamento restituisca il percorso
                const mockServerPath = `/workspace/.attachments/${f.name}`;
                this.attachments.push({ name: f.name, path: mockServerPath });
            }
            this.renderAttachmentChips();
            
            // AUTOMATIC PASTE FLOW (Più semplice e robusto)
            // Incolliamo direttamente i percorsi nella PTY così l'utente li vede sulla riga di comando
            const filePathsString = this.attachments.map(a => `"${a.path}"`).join(' ');
            this.wsClient.sendData(filePathsString + ' '); 
            
            // Svuotiamo i chips locali dopo averli "inviati" al terminale
            this.attachments = [];
            this.renderAttachmentChips();
        });

        // Stop Button
        containerEl.querySelector('#toolbar-btn-stop').addEventListener('click', () => {
            // Invio di SIGINT (Ctrl+C) tramite WebSocket o API dedicata
            this.wsClient.sendData('\x03'); 
        });
    }
}
```

---

## 4. Model Selector Interaction

Il flusso di cambio modello tramite Toolbar:
1. L'utente modifica il selettore `<select>` nella toolbar.
2. Viene catturato l'evento `change` e viene iniettato nello stream di stdin della PTY il comando testuale `/model <model_id>\n`.
3. Il bridge CLI (Claude Code) interpreta il comando e cambia il modello attivo.
4. (*Opzionale*) Il client esegue in background una chiamata `PUT /sessions/{id}` per aggiornare il database in modo persistente.
5. Il menu a tendina recupera i valori suggeriti dalla configurazione `UserSettingsDB.favorite_models`.

## 5. File Attachment Flow

Sono state valutate due opzioni per gestire l'inserimento dei file nel prompt:
- **Intercettazione Tasto Invio**: Tenere i file "appesi" nella toolbar sotto forma di *chip*. Ascoltare l'Enter della PTY, combinare l'input testuale corrente con i file, e svuotare i chip. (Molto complesso da gestire in maniera sincronizzata con `xterm.js`).
- **Automatic Paste Flow (Selezionato e Raccomandato)**:
  1. L'utente clicca su 📎.
  2. Viene effettuato l'upload.
  3. L'applicazione prende l'elenco dei path restituiti dal server e li inietta (tramite `wsClient.sendData(...)`) direttamente nell'input del terminale come se l'utente avesse fatto "Copia/Incolla" del percorso.
  4. L'utente può così vedere il file inserito nella riga, comporci attorno il testo del prompt e premere normalmente Invio.

---

## 6. CSS Additions (`themes.css`)

Ecco le classi CSS da aggiungere a `static/css/themes.css` per garantire l'aderenza al Neo-Brutalist design.

```css
/* themes.css Additions for Step 06 */

/* --- NEO-BRUTALIST BASICS --- */
.border-black { border-color: #000; }
.shadow-hard { box-shadow: 4px 4px 0px 0px #000; }
.shadow-hard-sm { box-shadow: 2px 2px 0px 0px #000; }

.neo-panel {
    border: 3px solid #000;
    box-shadow: 6px 6px 0px 0px #000;
}

.neo-input {
    border: 2px solid #000;
    padding: 0.5rem;
    font-family: inherit;
    box-shadow: 2px 2px 0px 0px #000;
    transition: all 0.1s ease;
}

.neo-input:focus {
    outline: none;
    box-shadow: 4px 4px 0px 0px #FF5F1F;
    border-color: #FF5F1F;
}

.neo-btn {
    border: 2px solid #000;
    box-shadow: 4px 4px 0px 0px #000;
    transition: all 0.1s ease;
    cursor: pointer;
}

.neo-btn:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px 0px #000;
}

.neo-btn:active {
    transform: translate(2px, 2px);
    box-shadow: 0px 0px 0px 0px #000;
}

/* --- AGENT GALLERY --- */
.preset-card {
    border: 3px solid #000;
    box-shadow: 6px 6px 0px 0px #000;
}

.preset-card:hover {
    /* Hover effect: shift shadow, border color */
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0px 0px #FF5F1F;
    border-color: #FF5F1F;
}

/* --- TOOLBAR --- */
.toolbar-container {
    box-shadow: 0px 4px 0px 0px rgba(0,0,0,1);
}

.toolbar-container button:focus-visible {
    outline: 2px dashed #FF5F1F;
    outline-offset: 4px;
}
```

Questo step fornisce un controllo immediato sulle sessioni attive e una panoramica molto visiva (la Gallery) degli agenti disponibili, aderendo perfettamente al look and feel richiesto dal progetto.

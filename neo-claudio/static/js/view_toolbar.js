export class Toolbar {
    constructor(session, wsClient) {
        this.session = session || {};
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
            if (this.wsClient) {
                this.wsClient.sendData(`/model ${newModel}\n`);
            }
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
            if (this.wsClient) {
                this.wsClient.sendData(filePathsString + ' '); 
            }
            
            // Svuotiamo i chips locali dopo averli "inviati" al terminale
            this.attachments = [];
            this.renderAttachmentChips();
        });

        // Stop Button
        containerEl.querySelector('#toolbar-btn-stop').addEventListener('click', () => {
            // Invio di SIGINT (Ctrl+C) tramite WebSocket o API dedicata
            if (this.wsClient) {
                this.wsClient.sendData('\x03'); 
            }
        });
        
        // Drag & drop logic
        const termContainer = document.getElementById('terminal-container') || document.body;
        termContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        termContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                fileInput.dispatchEvent(new Event('change'));
            }
        });
        
        // Paste logic
        document.addEventListener('paste', (e) => {
            if (e.clipboardData.files.length > 0) {
                fileInput.files = e.clipboardData.files;
                fileInput.dispatchEvent(new Event('change'));
            }
        });
    }
}

export class Toolbar {
    constructor(session, wsClient) {
        this.session = session || {};
        this.wsClient = wsClient; // WebSocketClient instance per dialogare con la PTY
        this.attachments = []; // Lista locale di percorsi file allegati
    }

    render(containerEl) {
        const toolbarHtml = `
            <div class="toolbar-container h-12 flex items-center justify-between px-4 border-b-2 border-black bg-[#f4f4f4] font-headline text-sm z-10 shrink-0">
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
                    <button id="toolbar-btn-mcp" class="neo-btn neo-btn-black neo-btn-sm" title="Toggle MCP Apps Sidebar (Ctrl+E)">
                        MCP Apps
                    </button>
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
            <div class="flex items-center gap-2 cursor-pointer hover:text-[#FF5F1F] font-headline font-bold text-xs uppercase" title="Cambia Preset">
                <span class="text-lg">${p.icon}</span>
                <span>${p.name}</span>
            </div>
        `;
    }

    renderModelSelector() {
        const models = ['poolside/laguna-s-2.1:free', 'anthropic/claude-3.5-sonnet', 'deepseek/deepseek-r1'];
        const current = this.session.model || models[0];
        
        return `
            <select id="toolbar-model-select" class="neo-input h-8 py-0 px-2 bg-white cursor-pointer text-xs uppercase font-headline font-bold border-2 border-black shadow-[2px_2px_0px_#000]">
                ${models.map(m => `<option value="${m}" ${m === current ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
        `;
    }

    renderAttachButton() {
        return `
            <button id="toolbar-btn-attach" class="neo-btn neo-btn-white neo-btn-sm">
                <span>📎</span> <span>Allega</span>
            </button>
        `;
    }

    renderStopButton() {
        return `
            <button id="toolbar-btn-stop" class="neo-btn neo-btn-white neo-btn-sm text-red-600">
                <span class="block w-2.5 h-2.5 bg-red-600 rounded-none border border-black"></span> Stop
            </button>
        `;
    }

    renderConnectionStatus() {
        return `
            <div id="ws-status-indicator" class="flex items-center gap-2 text-xs font-headline font-bold">
                <span class="status-dot w-2.5 h-2.5 rounded-none bg-green-500 border border-black inline-block animate-pulse"></span>
                <span class="uppercase text-[11px]">Connesso</span>
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
            if (files.length === 0) return;

            for (let f of files) {
                const formData = new FormData();
                formData.append('file', f);
                try {
                    const res = await fetch('/uploads', {
                        method: 'POST',
                        body: formData
                    });
                    if (res.ok) {
                        const data = await res.json();
                        this.attachments.push({ name: data.name, path: data.path });
                    }
                } catch (err) {
                    console.error("Failed to upload file:", err);
                    this.attachments.push({ name: f.name, path: f.name });
                }
            }
            
            this.renderAttachmentChips();
            
            // Incolliamo i percorsi nella PTY
            const filePathsString = this.attachments.map(a => `"${a.path}"`).join(' ');
            if (this.wsClient && filePathsString) {
                this.wsClient.sendData(filePathsString + ' '); 
            }
        });

        // Stop Button
        containerEl.querySelector('#toolbar-btn-stop').addEventListener('click', () => {
            if (this.wsClient) {
                this.wsClient.sendData('\x03'); 
            }
        });
        
        // MCP Sidebar Toggle
        const mcpBtn = containerEl.querySelector('#toolbar-btn-mcp');
        if (mcpBtn) {
            mcpBtn.addEventListener('click', () => {
                if (window.stregattoApp && window.stregattoApp.mcpSidebar) {
                    window.stregattoApp.mcpSidebar.toggleSidebar();
                }
            });
        }
        
        // Drag & drop logic limitata al container locale
        const termContainer = document.getElementById('terminal-area') || containerEl;
        termContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        termContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                fileInput.dispatchEvent(new Event('change'));
            }
        });
    }
}

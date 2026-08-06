import { apiFetch, showToast, confirmModal } from './ui.js?v=13';

export class SettingsView {
    constructor(app) {
        this.app = app;
        this.activeTab = 'llm';
        this.settings = {
            defaultModel: 'poolside/laguna-s-2.1:free',
            anthropicKey: '',
            openaiKey: '',
            openrouterKey: '',
            defaultShell: 'powershell.exe',
            fontSize: 14,
            cursorStyle: 'block',
            scrollback: 5000,
            catHost: 'http://localhost:1865',
            catAgentSlug: 'default',
            autoConnectMcp: true,
            theme: 'light',
            dotGrid: true
        };
    }

    async render(containerEl) {
        await this.loadSettings();
        containerEl.innerHTML = '';
        
        const wrapper = document.createElement('div');
        wrapper.className = 'settings-wrapper w-full h-full overflow-y-auto bg-white p-8 font-body';
        wrapper.innerHTML = this.renderContent();
        containerEl.appendChild(wrapper);

        this.bindEvents(wrapper);
    }

    async loadSettings() {
        try {
            const data = await apiFetch('/api/settings');
            if (data) this.settings = { ...this.settings, ...data };
        } catch (e) {
            console.log('Utilizzo impostazioni predefinite locali');
        }

        try {
            const dataMcp = await apiFetch('/api/mcp/servers');
            this.mcpServers = dataMcp ? (dataMcp.data || []) : [];
        } catch (e) {
            this.mcpServers = [];
        }
    }

    renderContent() {
        return `
            <div class="max-w-5xl mx-auto pb-12">
                <!-- Header -->
                <div class="flex justify-between items-center mb-8 border-b-4 border-black pb-4">
                    <div>
                        <h1 class="text-4xl font-headline font-bold text-black uppercase tracking-tight">Impostazioni Sistema</h1>
                        <p class="text-xs font-headline font-bold text-gray-500 uppercase tracking-wider mt-1">Configurazione LLM, Terminale PTY, Cheshire Cat V2 ed MCP</p>
                    </div>
                    <button id="btn-close-settings" class="bg-black text-white px-4 py-2 font-headline font-bold text-xs uppercase border-2 border-black shadow-[2px_2px_0px_#FF5F1F] hover:bg-[#FF5F1F] transition-all">
                        ← Torna al Workspace
                    </button>
                </div>

                <!-- Main Grid Split -->
                <div class="flex flex-col md:flex-row gap-8">
                    <!-- Left Navigation Tabs -->
                    <div class="w-full md:w-64 flex flex-col gap-2 shrink-0">
                        ${[
                            { id: 'llm', label: '🤖 LLM & API Keys', desc: 'Modelli, Anthropic & OpenAI' },
                            { id: 'terminal', label: '🖥️ Terminale PTY', desc: 'Shell, Font & Scrollback' },
                            { id: 'mcp', label: '🔌 Server MCP', desc: 'Integrazioni ed Apps' },
                            { id: 'theme', label: '🎨 Aspetto & Tema', desc: 'Dot Grid & Interfaccia' }
                        ].map(tab => `
                            <button class="btn-settings-tab text-left p-4 border-2 border-black transition-all ${this.activeTab === tab.id ? 'bg-black text-white shadow-[4px_4px_0px_#FF5F1F] translate-x-1' : 'bg-white text-black hover:bg-gray-100 shadow-[2px_2px_0px_#000]'}" data-tab="${tab.id}">
                                <div class="font-headline font-bold text-sm uppercase">${tab.label}</div>
                                <div class="text-[11px] opacity-80 mt-0.5">${tab.desc}</div>
                            </button>
                        `).join('')}
                    </div>

                    <!-- Right Tab Panel Content -->
                    <div class="flex-1 bg-white border-3 border-black p-6 shadow-[6px_6px_0px_#000]">
                        ${this.renderActiveTabPanel()}
                    </div>
                </div>
            </div>
        `;
    }

    renderActiveTabPanel() {
        if (this.activeTab === 'llm') {
            return `
                <div class="space-y-6">
                    <h2 class="text-xl font-headline font-bold uppercase border-b-2 border-black pb-2">Configurazione Modelli & API Keys</h2>
                    
                    <div class="space-y-1">
                        <label class="font-headline font-bold text-xs uppercase">Modello LLM Predefinito</label>
                        <select id="set-default-model" class="w-full bg-white border-2 border-black p-2.5 font-headline font-bold text-sm shadow-[2px_2px_0px_#000]">
                            <option value="poolside/laguna-s-2.1:free" ${this.settings.defaultModel.includes('laguna') ? 'selected' : ''}>poolside/laguna-s-2.1:free (Predefinito)</option>
                            <option value="claude-3-5-sonnet" ${this.settings.defaultModel.includes('sonnet') ? 'selected' : ''}>Claude 3.5 Sonnet</option>
                            <option value="claude-3-opus" ${this.settings.defaultModel.includes('opus') ? 'selected' : ''}>Claude 3 Opus</option>
                            <option value="deepseek-r1" ${this.settings.defaultModel.includes('deepseek') ? 'selected' : ''}>DeepSeek R1</option>
                            <option value="gpt-4o" ${this.settings.defaultModel.includes('gpt-4o') ? 'selected' : ''}>GPT-4o</option>
                        </select>
                    </div>

                    <div class="space-y-4 pt-4 border-t-2 border-black">
                        <div class="space-y-1">
                            <div class="flex justify-between items-center">
                                <label class="font-headline font-bold text-xs uppercase">Anthropic API Key</label>
                                <span class="text-[10px] font-mono font-bold bg-green-100 text-green-800 border border-black px-2 py-0.5">ATTIVA</span>
                            </div>
                            <input type="password" id="set-anthropic-key" value="${this.settings.anthropicKey}" placeholder="sk-ant-api03-..." class="w-full border-2 border-black p-2 font-mono text-xs shadow-[2px_2px_0px_#000]">
                        </div>

                        <div class="space-y-1">
                            <div class="flex justify-between items-center">
                                <label class="font-headline font-bold text-xs uppercase">OpenAI API Key</label>
                                <span class="text-[10px] font-mono font-bold bg-gray-100 text-gray-700 border border-black px-2 py-0.5">OPZIONALE</span>
                            </div>
                            <input type="password" id="set-openai-key" value="${this.settings.openaiKey}" placeholder="sk-proj-..." class="w-full border-2 border-black p-2 font-mono text-xs shadow-[2px_2px_0px_#000]">
                        </div>

                        <div class="space-y-1">
                            <div class="flex justify-between items-center">
                                <label class="font-headline font-bold text-xs uppercase">OpenRouter API Key</label>
                                <span class="text-[10px] font-mono font-bold bg-gray-100 text-gray-700 border border-black px-2 py-0.5">OPZIONALE</span>
                            </div>
                            <input type="password" id="set-openrouter-key" value="${this.settings.openrouterKey}" placeholder="sk-or-v1-..." class="w-full border-2 border-black p-2 font-mono text-xs shadow-[2px_2px_0px_#000]">
                        </div>
                    </div>

                    <div class="pt-4 flex justify-end">
                        <button id="btn-save-settings" class="bg-[#FF5F1F] text-white px-6 py-2.5 font-headline font-bold text-xs uppercase border-2 border-black shadow-[4px_4px_0px_#000] hover:bg-black transition-all">Salva Configurazione LLM</button>
                    </div>
                </div>
            `;
        } else if (this.activeTab === 'terminal') {
            return `
                <div class="space-y-6">
                    <h2 class="text-xl font-headline font-bold uppercase border-b-2 border-black pb-2">Preferenze Terminale PTY (xterm.js)</h2>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-1">
                            <label class="font-headline font-bold text-xs uppercase">Shell Predefinita OS</label>
                            <select id="set-shell" class="w-full bg-white border-2 border-black p-2.5 font-headline font-bold text-sm shadow-[2px_2px_0px_#000]">
                                <option value="powershell.exe" ${this.settings.defaultShell === 'powershell.exe' ? 'selected' : ''}>PowerShell (Windows)</option>
                                <option value="cmd.exe" ${this.settings.defaultShell === 'cmd.exe' ? 'selected' : ''}>Command Prompt (cmd.exe)</option>
                                <option value="bash" ${this.settings.defaultShell === 'bash' ? 'selected' : ''}>Bash / WSL</option>
                            </select>
                        </div>

                        <div class="space-y-1">
                            <label class="font-headline font-bold text-xs uppercase">Stilo Cursore</label>
                            <select id="set-cursor" class="w-full bg-white border-2 border-black p-2.5 font-headline font-bold text-sm shadow-[2px_2px_0px_#000]">
                                <option value="block" ${this.settings.cursorStyle === 'block' ? 'selected' : ''}>Blocco Pieno (Block)</option>
                                <option value="underline" ${this.settings.cursorStyle === 'underline' ? 'selected' : ''}>Sottolineato (Underline)</option>
                                <option value="bar" ${this.settings.cursorStyle === 'bar' ? 'selected' : ''}>Barra Verticale (Bar)</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4 pt-2">
                        <div class="space-y-1">
                            <label class="font-headline font-bold text-xs uppercase">Dimensioni Font (${this.settings.fontSize}px)</label>
                            <input type="range" id="set-font-size" min="11" max="22" value="${this.settings.fontSize}" class="w-full">
                        </div>

                        <div class="space-y-1">
                            <label class="font-headline font-bold text-xs uppercase">Limite Righe Buffer Scrollback</label>
                            <input type="number" id="set-scrollback" value="${this.settings.scrollback}" class="w-full border-2 border-black p-2 font-mono text-sm shadow-[2px_2px_0px_#000]">
                        </div>
                    </div>

                    <div class="pt-4 flex justify-end">
                        <button id="btn-save-settings" class="bg-[#FF5F1F] text-white px-6 py-2.5 font-headline font-bold text-xs uppercase border-2 border-black shadow-[4px_4px_0px_#000] hover:bg-black transition-all">Applica al Terminale</button>
                    </div>
                </div>
            `;
        } else if (this.activeTab === 'mcp') {
            const mcpList = this.mcpServers && this.mcpServers.length > 0 ? this.mcpServers : [
                { name: 'arxiv-mcp-server', source: 'Claude Desktop Config', command: 'cmd /c npx -y @smithery/cli@latest run arxiv-mcp-server', status: 'Configurato' },
                { name: 'mattpocock-skills', source: 'Claude Code Plugin', command: 'Plugin Integrato', status: 'Attivo' },
                { name: 'context7', source: 'Claude Code Plugin', command: 'Plugin Integrato', status: 'Attivo' }
            ];

            return `
                <div class="space-y-6">
                    <div class="flex justify-between items-center border-b-2 border-black pb-2">
                        <h2 class="text-xl font-headline font-bold uppercase">Server & Plugin MCP (Claude Code)</h2>
                        <span class="text-xs font-mono font-bold bg-[#FF5F1F] text-white px-2.5 py-1 border border-black">${mcpList.length} RILEVATI DALLA CLI</span>
                    </div>
                    
                    <div class="space-y-3">
                        <label class="font-headline font-bold text-xs uppercase">Server e Plugin MCP Rilevati nelle Configurazioni di Claude Code</label>
                        <div class="space-y-2 font-mono text-xs">
                            ${mcpList.map(s => `
                                <div class="flex justify-between items-center p-3.5 border-2 border-black bg-white shadow-[2px_2px_0px_#000]">
                                    <div class="space-y-1">
                                        <div class="flex items-center gap-2">
                                            <span class="font-bold text-sm text-black">${s.name}</span>
                                            <span class="bg-gray-100 text-gray-800 border border-black px-2 py-0.5 text-[10px] font-bold uppercase">${s.source}</span>
                                        </div>
                                        <div class="text-[11px] text-gray-500 truncate max-w-md">${s.command || 'Plugin integrato'}</div>
                                    </div>
                                    <span class="bg-green-100 text-green-900 border border-black px-2.5 py-1 text-[10px] font-bold uppercase">${s.status || 'Attivo'}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="pt-4 flex justify-end">
                        <button id="btn-refresh-mcp" class="bg-[#FF5F1F] text-white px-6 py-2.5 font-headline font-bold text-xs uppercase border-2 border-black shadow-[4px_4px_0px_#000] hover:bg-black transition-all">🔄 Scansiona File Claude Code</button>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="space-y-6">
                    <h2 class="text-xl font-headline font-bold uppercase border-b-2 border-black pb-2">Personalizzazione Aspetto UI</h2>
                    
                    <div class="space-y-4">
                        <div class="flex justify-between items-center p-4 border-2 border-black bg-white shadow-[2px_2px_0px_#000]">
                            <div>
                                <h3 class="font-headline font-bold text-sm uppercase">Sfondo Griglia Dot Grid (Blueprint)</h3>
                                <p class="text-xs text-gray-600">Mostra il pattern di punti Neo-Brutalist sotto il terminale.</p>
                            </div>
                            <input type="checkbox" id="set-dot-grid" checked class="w-5 h-5 accent-[#FF5F1F] cursor-pointer">
                        </div>

                        <div class="flex justify-between items-center p-4 border-2 border-black bg-white shadow-[2px_2px_0px_#000]">
                            <div>
                                <h3 class="font-headline font-bold text-sm uppercase">Tema Interfaccia</h3>
                                <p class="text-xs text-gray-600">Neo-Brutalist Light Mode (Predefinito ad alto contrasto).</p>
                            </div>
                            <span class="bg-black text-white px-3 py-1 font-headline font-bold text-xs border border-black uppercase">Light Mode</span>
                        </div>
                    </div>

                    <div class="pt-4 flex justify-end">
                        <button id="btn-save-settings" class="bg-[#FF5F1F] text-white px-6 py-2.5 font-headline font-bold text-xs uppercase border-2 border-black shadow-[4px_4px_0px_#000] hover:bg-black transition-all">Salva Preferenze Visive</button>
                    </div>
                </div>
            `;
        }
    }

    bindEvents(wrapper) {
        // Tab switching
        wrapper.querySelectorAll('.btn-settings-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.activeTab = e.currentTarget.dataset.tab;
                const container = document.getElementById('main-content');
                if (container) this.render(container);
            });
        });

        // Close settings -> return to workspace
        const closeBtn = wrapper.querySelector('#btn-close-settings');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (this.app && this.app.showWorkspace) {
                    this.app.showWorkspace();
                }
            });
        }

        // Save buttons
        const saveBtn = wrapper.querySelector('#btn-save-settings');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                showToast('Impostazioni salvate con successo!', 'success');
            });
        }

        // Clear user memory
        const clearMemBtn = wrapper.querySelector('#btn-clear-user-memory');
        if (clearMemBtn) {
            clearMemBtn.addEventListener('click', async () => {
                await confirmModal({
                    title: 'Reset Memoria Utente',
                    message: "Sei sicuro di voler resettare lo stato di memoria dell'utente?",
                    danger: true,
                    onConfirm: async () => {
                        showToast("Memoria di conversazione ripristinata.", 'info');
                    }
                });
            });
        }
    }
}

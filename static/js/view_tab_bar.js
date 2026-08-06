/**
 * static/js/view_tab_bar.js
 * Barra Unificata del Workspace e Gestione Sessioni (Soft Neo-Brutalist)
 */

import { apiFetch, createContextMenu, createModal, renderFormField, confirmModal, showToast } from './ui.js?v=13';

export class TabBar {
    constructor(containerEl, app) {
        this.container = containerEl;
        this.app = app;
        this.sessions = [];
        this.presets = [];
        this.activeSessionId = null;
        this.attachments = [];
        this.initShell();
        this.loadPresets();
    }

    async loadPresets() {
        try {
            this.presets = await apiFetch('/api/presets') || [];
        } catch (e) {
            this.presets = [];
        }
    }

    initShell() {
        this.container.innerHTML = `
            <div class="workspace-header-wrapper flex items-center justify-between bg-white w-full border-b-2 border-black px-3 py-2 gap-3 font-headline text-xs z-20 shrink-0 select-none">
                
                <!-- Left Section: Active Session Dropdown & Quick Switcher Chips -->
                <div class="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    <!-- Session Selector Dropdown Button -->
                    <button id="btn-session-dropdown" class="neo-btn neo-btn-white neo-btn-sm flex items-center gap-2 shrink-0 border-2 border-black font-bold uppercase shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#FF5F1F]">
                        <span id="active-session-icon">🐱</span>
                        <span id="active-session-name" class="truncate max-w-[140px]">Nessuna Sessione</span>
                        <span class="text-[10px]">▼</span>
                    </button>

                    <div class="w-px h-5 bg-black shrink-0 mx-0.5"></div>

                    <!-- Horizontal Compact Session Chips -->
                    <div id="tabs-container" class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                        <!-- Quick session tab chips rendered here -->
                    </div>

                    <!-- New Session Button -->
                    <button id="btn-header-new-session" class="neo-btn neo-btn-orange neo-btn-sm font-bold shrink-0 ml-1" title="Nuova Sessione">
                        + NUOVA
                    </button>
                </div>

                <!-- Center/Right Section: Attachments, Model, MCP Apps & Status -->
                <div class="flex items-center gap-2 shrink-0">
                    <!-- Attachment Chips List -->
                    <div id="attachment-chips-container" class="flex items-center gap-1 overflow-x-auto max-w-[180px]"></div>

                    <!-- Attach File Button -->
                    <button id="header-btn-attach" class="neo-btn neo-btn-white neo-btn-sm font-bold flex items-center gap-1" title="Allega File">
                        <span>📎</span> <span class="hidden sm:inline">Allega</span>
                    </button>
                    <input type="file" id="header-hidden-file-input" class="hidden" multiple>

                    <div class="w-px h-5 bg-black shrink-0"></div>

                    <!-- LLM Model Selector -->
                    <select id="header-model-select" class="neo-input h-7 py-0 px-2 bg-white cursor-pointer text-xs uppercase font-headline font-bold border-2 border-black shadow-[2px_2px_0px_#000] focus:shadow-[2px_2px_0px_#FF5F1F]">
                        <option value="poolside/laguna-s-2.1:free">Laguna S 2.1 (Free)</option>
                        <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                        <option value="deepseek/deepseek-r1">DeepSeek R1</option>
                        <option value="openai/gpt-4o">GPT-4o</option>
                    </select>

                    <div class="w-px h-5 bg-black shrink-0"></div>

                    <!-- MCP Apps Sidebar Toggle Button -->
                    <button id="header-btn-mcp" class="neo-btn neo-btn-black neo-btn-sm font-bold flex items-center gap-1" title="Apri Sidebar MCP Apps (Ctrl+E)">
                        <span>⚡</span> <span class="hidden md:inline">MCP Apps</span>
                    </button>

                    <!-- Connection Status Indicator -->
                    <div id="ws-status-indicator" class="flex items-center gap-1.5 text-[11px] font-bold uppercase ml-1" title="Stato Connessione PTY WebSocket">
                        <span class="status-dot w-2.5 h-2.5 bg-green-500 border border-black inline-block animate-pulse"></span>
                        <span class="hidden lg:inline">Connesso</span>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // Session Dropdown button click
        const dropdownBtn = this.container.querySelector('#btn-session-dropdown');
        if (dropdownBtn) {
            dropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.renderSessionPopup(dropdownBtn);
            });
        }

        // New Session button click
        const newSessionBtn = this.container.querySelector('#btn-header-new-session');
        if (newSessionBtn) {
            newSessionBtn.addEventListener('click', () => {
                this.renderNewSessionModal();
            });
        }

        // Model Selector change
        const modelSelect = this.container.querySelector('#header-model-select');
        if (modelSelect) {
            modelSelect.addEventListener('change', (e) => {
                const newModel = e.target.value;
                if (this.activeSessionId && this.app && this.app.termManager) {
                    const conn = this.app.termManager.connections.get(this.activeSessionId);
                    if (conn && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
                        conn.ws.send(new TextEncoder().encode(`/model ${newModel}\n`));
                        showToast(`Modello impostato su ${newModel}`, 'info');
                    }
                }
            });
        }

        // Attach Button & File Input
        const fileInput = this.container.querySelector('#header-hidden-file-input');
        const attachBtn = this.container.querySelector('#header-btn-attach');
        if (attachBtn && fileInput) {
            attachBtn.addEventListener('click', () => fileInput.click());

            fileInput.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files);
                if (files.length === 0) return;

                for (let f of files) {
                    const formData = new FormData();
                    formData.append('file', f);
                    try {
                        const res = await fetch('/uploads', { method: 'POST', body: formData });
                        if (res.ok) {
                            const data = await res.json();
                            this.attachments.push({ name: data.name, path: data.url || data.name });
                        }
                    } catch (err) {
                        console.error("Failed to upload file:", err);
                        this.attachments.push({ name: f.name, path: f.name });
                    }
                }

                this.renderAttachmentChips();

                // Send file path string to PTY WebSocket
                if (this.activeSessionId && this.app && this.app.termManager) {
                    const conn = this.app.termManager.connections.get(this.activeSessionId);
                    if (conn && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
                        const filePathsString = this.attachments.map(a => `"${a.path}"`).join(' ');
                        conn.ws.send(new TextEncoder().encode(filePathsString + ' '));
                    }
                }
            });
        }

        // MCP Apps Sidebar button
        const mcpBtn = this.container.querySelector('#header-btn-mcp');
        if (mcpBtn) {
            mcpBtn.addEventListener('click', () => {
                if (this.app && this.app.mcpSidebar) {
                    this.app.mcpSidebar.toggleSidebar();
                }
            });
        }
    }

    renderAttachmentChips() {
        const container = this.container.querySelector('#attachment-chips-container');
        if (!container) return;

        container.innerHTML = this.attachments.map((file, idx) => `
            <div class="flex items-center gap-1 bg-amber-100 border border-black px-1.5 py-0.5 text-[10px] whitespace-nowrap shadow-[1px_1px_0px_#000] font-headline font-bold">
                <span>📎 ${file.name}</span>
                <button class="btn-remove-attachment hover:text-red-600 font-bold ml-0.5" data-idx="${idx}">✕</button>
            </div>
        `).join('');

        container.querySelectorAll('.btn-remove-attachment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx, 10);
                this.attachments.splice(idx, 1);
                this.renderAttachmentChips();
            });
        });
    }

    loadSessions(sessionsData) {
        if (Array.isArray(sessionsData)) {
            this.sessions = sessionsData;
        } else if (typeof sessionsData === 'object' && sessionsData !== null) {
            this.sessions = [
                ...(sessionsData.active || []),
                ...(sessionsData.suspended || []),
                ...(sessionsData.archived || [])
            ];
        } else {
            this.sessions = [];
        }

        this.renderTabs();
        
        const activeSessions = this.sessions.filter(s => s.state !== 'archived');
        if (activeSessions.length > 0) {
            const target = activeSessions.find(s => s.id === this.activeSessionId) || activeSessions[0];
            this.activateTab(target.id);
        } else {
            this.activeSessionId = null;
            this.updateHeaderPill(null);
            this.app.clearTerminalArea();
        }
    }

    renderTabs() {
        const tabsContainer = this.container.querySelector('#tabs-container');
        if (!tabsContainer) return;
        tabsContainer.innerHTML = '';

        const activeSessions = this.sessions.filter(s => s.state !== 'archived');
        const sorted = [...activeSessions].sort((a, b) => {
            if (Boolean(a.pinned) === Boolean(b.pinned)) return 0;
            return a.pinned ? -1 : 1;
        });

        sorted.forEach(session => {
            tabsContainer.appendChild(this.createTabChip(session));
        });

        const currentActive = this.sessions.find(s => s.id === this.activeSessionId);
        this.updateHeaderPill(currentActive);
    }

    createTabChip(session) {
        const chip = document.createElement('div');
        const isActive = session.id === this.activeSessionId;

        chip.className = `session-tab-chip flex items-center gap-1.5 px-2.5 py-1 border-2 border-black cursor-pointer select-none transition-all text-xs font-headline font-bold shrink-0 ${
            isActive 
                ? 'bg-black text-white shadow-[2px_2px_0px_#FF5F1F]' 
                : 'bg-white text-black hover:bg-gray-100 shadow-[1px_1px_0px_#000]'
        }`;
        chip.dataset.id = session.id;

        chip.innerHTML = `
            ${session.pinned ? '<span class="text-[10px]">📌</span>' : ''}
            <span class="truncate max-w-[110px]">${session.name}</span>
            <button class="btn-close-chip hover:text-red-500 opacity-70 hover:opacity-100 font-bold ml-1 text-[11px]" title="Chiudi Sessione">✕</button>
        `;

        chip.addEventListener('click', (e) => {
            if (e.target.closest('.btn-close-chip')) {
                e.stopPropagation();
                this.closeSessionModal(session.id);
                return;
            }
            this.activateTab(session.id);
        });

        return chip;
    }

    updateHeaderPill(session) {
        const iconEl = this.container.querySelector('#active-session-icon');
        const nameEl = this.container.querySelector('#active-session-name');
        if (!iconEl || !nameEl) return;

        if (session) {
            iconEl.innerText = session.pinned ? '📌' : '🐱';
            nameEl.innerText = session.name;
        } else {
            iconEl.innerText = '📁';
            nameEl.innerText = 'Nessuna Sessione';
        }
    }

    activateTab(sessionId) {
        this.activeSessionId = sessionId;
        this.renderTabs();
        this.app.switchActiveTerminal(sessionId);
    }

    /**
     * Ad-hoc Popup Menu per scegliere / gestire le sessioni attive
     */
    renderSessionPopup(anchorEl) {
        const oldPopup = document.getElementById('session-popup-menu');
        if (oldPopup) {
            oldPopup.remove();
            return;
        }

        const rect = anchorEl.getBoundingClientRect();
        const popup = document.createElement('div');
        popup.id = 'session-popup-menu';
        popup.className = 'fixed bg-white border-2 border-black shadow-[6px_6px_0px_#000] z-50 p-2 w-[280px] font-headline text-xs flex flex-col gap-1';
        popup.style.top = `${rect.bottom + 6}px`;
        popup.style.left = `${rect.left}px`;

        const activeSessions = this.sessions.filter(s => s.state !== 'archived');

        popup.innerHTML = `
            <div class="px-2 py-1 font-bold text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-300 flex justify-between items-center">
                <span>Sessioni Attive (${activeSessions.length})</span>
                <button id="popup-btn-new" class="text-[#FF5F1F] hover:underline font-bold">+ NUOVA</button>
            </div>
            
            <div class="max-h-[220px] overflow-y-auto flex flex-col gap-1 py-1">
                ${activeSessions.length === 0 ? `
                    <div class="p-3 text-center text-gray-500 text-xs">Nessuna sessione aperta</div>
                ` : activeSessions.map(s => {
                    const isActive = s.id === this.activeSessionId;
                    return `
                        <div class="session-item-row flex items-center justify-between p-2 border border-black cursor-pointer transition-all ${isActive ? 'bg-[#FF5F1F] text-white font-bold shadow-[2px_2px_0px_#000]' : 'bg-white hover:bg-gray-100 text-black shadow-[1px_1px_0px_#000]'}" data-id="${s.id}">
                            <div class="flex items-center gap-2 min-w-0 flex-1">
                                <span>${s.pinned ? '📌' : '🐱'}</span>
                                <span class="truncate">${s.name}</span>
                            </div>
                            <div class="flex items-center gap-1 text-[11px] shrink-0">
                                <button class="btn-pin-item hover:scale-110 p-0.5" data-id="${s.id}" title="${s.pinned ? 'Rimuovi Pin' : 'Fissa'}">${s.pinned ? '📌' : '📍'}</button>
                                <button class="btn-rename-item hover:scale-110 p-0.5" data-id="${s.id}" title="Rinomina">✏️</button>
                                <button class="btn-close-item hover:text-red-600 font-bold p-0.5" data-id="${s.id}" title="Chiudi">✕</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        document.body.appendChild(popup);

        // Bind events inside popup
        popup.querySelector('#popup-btn-new').addEventListener('click', () => {
            popup.remove();
            this.renderNewSessionModal();
        });

        popup.querySelectorAll('.session-item-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                const sid = row.dataset.id;
                popup.remove();
                this.activateTab(sid);
            });
        });

        popup.querySelectorAll('.btn-pin-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const session = this.sessions.find(s => s.id === btn.dataset.id);
                if (session) this.togglePin(session);
                popup.remove();
            });
        });

        popup.querySelectorAll('.btn-rename-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const session = this.sessions.find(s => s.id === btn.dataset.id);
                if (session) this.renameSession(session);
                popup.remove();
            });
        });

        popup.querySelectorAll('.btn-close-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                popup.remove();
                this.closeSessionModal(btn.dataset.id);
            });
        });

        const closePopup = (e) => {
            if (!popup.contains(e.target) && !anchorEl.contains(e.target)) {
                popup.remove();
                document.removeEventListener('click', closePopup);
            }
        };
        setTimeout(() => document.addEventListener('click', closePopup), 0);
    }

    /**
     * Modal ad-hoc per creare una Nuova Sessione
     */
    renderNewSessionModal() {
        if (!this.app || !this.app.activeProjectId) {
            showToast("Seleziona prima un progetto dalla sidebar", "error");
            return;
        }

        const presetOptions = this.presets.length > 0 ? this.presets : [
            { id: null, name: 'Stregatto (Default)', icon: '🐱', description: 'Accesso completo a tutti i tool CLI' },
            { id: null, name: 'Guardian (Reviewer)', icon: '🛡️', description: 'Profilo sola lettura e plan mode' },
            { id: null, name: 'Researcher', icon: '🔬', description: 'Ricerca web e analisi documenti' }
        ];

        const contentHtml = `
            ${renderFormField({ label: 'Nome Sessione', name: 'name', value: `Sessione ${this.sessions.length + 1}`, required: true })}
            <div class="my-2"></div>
            <label class="block font-headline font-bold text-xs uppercase mb-1">Seleziona Agent Preset</label>
            <div class="grid grid-cols-1 gap-2 border-2 border-black p-2 bg-gray-50 max-h-[180px] overflow-y-auto">
                ${presetOptions.map((p, idx) => `
                    <label class="flex items-center gap-3 p-2 border border-black bg-white cursor-pointer hover:bg-orange-50 transition-colors">
                        <input type="radio" name="preset_id" value="${p.id || ''}" ${idx === 0 ? 'checked' : ''}>
                        <span class="text-xl">${p.icon || '🐱'}</span>
                        <div class="flex-1 min-w-0">
                            <div class="font-headline font-bold text-xs">${p.name}</div>
                            <div class="text-[10px] text-gray-600 truncate">${p.description || ''}</div>
                        </div>
                    </label>
                `).join('')}
            </div>
            <div class="my-2"></div>
            ${renderFormField({
                label: 'Modello LLM Iniziale', name: 'model', type: 'select',
                value: 'poolside/laguna-s-2.1:free',
                options: [
                    { value: 'poolside/laguna-s-2.1:free', label: 'Laguna S 2.1 (Free)' },
                    { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
                    { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1' },
                    { value: 'openai/gpt-4o', label: 'GPT-4o' }
                ]
            })}
        `;

        createModal({
            id: 'modal-create-session',
            title: 'Crea Nuova Sessione',
            btnText: 'Avvia Sessione',
            maxWidth: '440px',
            contentHtml,
            onSubmit: async (data, formData, closeModal) => {
                try {
                    const newSession = await apiFetch(`/api/projects/${this.app.activeProjectId}/sessions`, {
                        method: 'POST',
                        body: {
                            name: data.name,
                            preset_id: data.preset_id || null,
                            model: data.model
                        }
                    });

                    closeModal();
                    this.sessions.push(newSession);
                    this.renderTabs();
                    this.activateTab(newSession.id);
                    showToast(`Sessione "${newSession.name}" creata!`, 'success');
                } catch (err) {
                    console.error("Failed to create session:", err);
                    showToast("Errore durante la creazione della sessione", 'error');
                }
            }
        });
    }

    /**
     * Modal ad-hoc per confermare la chiusura/eliminazione della sessione
     */
    async closeSessionModal(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;

        await confirmModal({
            title: 'Chiudi Sessione',
            message: `Sei sicuro di voler chiudere ed eliminare la sessione "${session.name}"? L'istanza terminale verrà terminata.`,
            danger: true,
            onConfirm: async () => {
                try {
                    await apiFetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
                    this.sessions = this.sessions.filter(s => s.id !== sessionId);

                    if (this.activeSessionId === sessionId) {
                        const remaining = this.sessions.filter(s => s.state !== 'archived');
                        this.activeSessionId = remaining.length > 0 ? remaining[remaining.length - 1].id : null;
                    }

                    this.renderTabs();
                    if (this.activeSessionId) {
                        this.app.switchActiveTerminal(this.activeSessionId);
                    } else {
                        this.app.clearTerminalArea();
                    }
                    showToast(`Sessione eliminata`, 'info');
                } catch (err) {
                    console.error("Failed to close session", err);
                    showToast("Errore durante l'eliminazione della sessione", 'error');
                }
            }
        });
    }

    async togglePin(session) {
        try {
            await apiFetch(`/api/sessions/${session.id}`, {
                method: 'PUT',
                body: { pinned: !session.pinned }
            });
            session.pinned = !session.pinned;
            this.renderTabs();
        } catch (err) {
            console.error(err);
        }
    }

    async renameSession(session) {
        const newName = prompt('Nuovo nome sessione:', session.name);
        if (newName && newName !== session.name) {
            try {
                await apiFetch(`/api/sessions/${session.id}`, {
                    method: 'PUT',
                    body: { name: newName }
                });
                session.name = newName;
                this.renderTabs();
            } catch (err) {
                console.error(err);
            }
        }
    }
}

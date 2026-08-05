/**
 * static/js/view_tab_bar.js
 * Componente Tab Bar per gestire i terminali xterm.js con stile Neo-Brutalist
 */

export class TabBar {
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
                    <button id="btn-archived" class="neo-btn-icon hover:bg-gray-200 p-2 font-bold text-sm" title="Sessioni Archiviate" style="display: none;">
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

        this.container.querySelector('#btn-archived').addEventListener('click', (e) => {
            this.renderArchivedDropdown(e);
        });
    }

    loadSessions(sessionsData) {
        this.sessions = sessionsData;
        this.renderTabs();
        this.updateArchivedCount();
        
        const activeSessions = this.sessions.filter(s => s.state === 'active');
        if (activeSessions.length > 0) {
            this.activateTab(activeSessions[0].id);
        } else {
            this.app.clearTerminalArea();
        }
    }

    updateArchivedCount() {
        const archivedSessions = this.sessions.filter(s => s.state === 'archived');
        const btn = this.container.querySelector('#btn-archived');
        const countSpan = this.container.querySelector('#archived-count');
        if (archivedSessions.length > 0) {
            btn.style.display = 'inline-block';
            countSpan.innerText = archivedSessions.length;
        } else {
            btn.style.display = 'none';
        }
    }

    renderTabs() {
        const tabsContainer = this.container.querySelector('#tabs-container');
        tabsContainer.innerHTML = '';
        
        const activeSessions = this.sessions.filter(s => s.state !== 'archived');

        const sorted = [...activeSessions].sort((a, b) => {
            if (a.pinned === b.pinned) return 0;
            return a.pinned ? -1 : 1;
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
            ${session.pinned ? '<span class="text-xs">📌</span>' : ''}
            <div class="flex-1 min-w-0 flex flex-col">
                <span class="font-bold truncate text-sm leading-tight">${session.name}</span>
                <span class="model-badge text-[10px] font-mono opacity-80 truncate uppercase">${session.model || 'CLAUDE 3.5'}</span>
            </div>
            ${!session.pinned ? \`
                <button class="close-btn neo-btn-icon opacity-0 group-hover:opacity-100 hover:text-red-500 font-bold ml-1">✕</button>
            \` : ''}
        `;

        tab.addEventListener('click', (e) => {
            if (e.target.closest('.close-btn')) {
                this.closeTab(session.id);
                return;
            }
            this.activateTab(session.id);
        });

        tab.addEventListener('auxclick', (e) => {
            if (e.button === 1 && !session.pinned) {
                e.preventDefault();
                this.closeTab(session.id);
            }
        });

        return tab;
    }

    activateTab(sessionId) {
        this.activeSessionId = sessionId;
        this.renderTabs();
        this.app.switchActiveTerminal(sessionId);
    }

    async closeTab(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;

        const action = confirm(\`Sospendere o Uccidere la sessione "\${session.name}"?\\nOK = Kill (Distrugge il processo)\\nCancel = Suspend (Mantiene lo stato)\`);
        
        try {
            if (action) {
                await fetch(\`/sessions/\${sessionId}\`, { method: 'DELETE' });
                this.sessions = this.sessions.filter(s => s.id !== sessionId);
            } else {
                await fetch(\`/sessions/\${sessionId}/suspend\`, { method: 'PUT' });
                session.state = 'suspended';
                // Aggiorniamo lo stato localmente
            }
            
            if (this.activeSessionId === sessionId) {
                const activeSessions = this.sessions.filter(s => s.state !== 'archived');
                this.activeSessionId = activeSessions.length > 0 ? activeSessions[activeSessions.length - 1].id : null;
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
        const oldMenu = document.getElementById('tab-context-menu');
        if (oldMenu) oldMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'tab-context-menu';
        menu.className = 'fixed bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] z-50 flex flex-col py-1 min-w-[150px]';
        menu.style.left = \`\${event.clientX}px\`;
        menu.style.top = \`\${event.clientY}px\`;

        const menuItems = [
            { label: 'Rinomina', action: () => this.renameSession(session) },
            { label: session.pinned ? 'Rimuovi Pin' : 'Fissa (Pin)', action: () => this.togglePin(session) },
            { label: 'Sospendi', action: () => this.suspendSession(session) },
            { label: 'Archivia', action: () => this.archiveSession(session) },
            { label: 'Chiudi (Kill)', action: () => this.closeTab(session.id), danger: true }
        ];

        menuItems.forEach(item => {
            const btn = document.createElement('button');
            btn.className = \`text-left px-4 py-2 text-sm hover:bg-gray-100 font-bold \${item.danger ? 'text-red-600' : ''}\`;
            btn.innerText = item.label;
            btn.addEventListener('click', () => { item.action(); menu.remove(); });
            menu.appendChild(btn);
        });

        document.body.appendChild(menu);
        setTimeout(() => document.addEventListener('click', () => menu.remove(), {once: true}), 0);
    }

    async togglePin(session) {
        try {
            const res = await fetch(\`/sessions/\${session.id}\`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ pinned: !session.pinned })
            });
            if (res.ok) {
                session.pinned = !session.pinned;
                this.renderTabs();
            }
        } catch (err) {
            console.error(err);
        }
    }

    async renameSession(session) {
        const newName = prompt('Nuovo nome sessione:', session.name);
        if (newName && newName !== session.name) {
            try {
                const res = await fetch(\`/sessions/\${session.id}\`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ name: newName })
                });
                if (res.ok) {
                    session.name = newName;
                    this.renderTabs();
                }
            } catch (err) {
                console.error(err);
            }
        }
    }

    async suspendSession(session) {
        try {
            const res = await fetch(\`/sessions/\${session.id}/suspend\`, { method: 'PUT' });
            if (res.ok) {
                session.state = 'suspended';
                this.renderTabs();
                if(this.activeSessionId === session.id) {
                     const activeSessions = this.sessions.filter(s => s.state !== 'archived');
                     this.activeSessionId = activeSessions.length > 0 ? activeSessions[activeSessions.length - 1].id : null;
                     if(this.activeSessionId) this.app.switchActiveTerminal(this.activeSessionId);
                     else this.app.clearTerminalArea();
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    async archiveSession(session) {
        try {
            const res = await fetch(\`/sessions/\${session.id}/archive\`, { method: 'PUT' });
            if (res.ok) {
                session.state = 'archived';
                this.renderTabs();
                this.updateArchivedCount();
                if(this.activeSessionId === session.id) {
                     const activeSessions = this.sessions.filter(s => s.state !== 'archived');
                     this.activeSessionId = activeSessions.length > 0 ? activeSessions[activeSessions.length - 1].id : null;
                     if(this.activeSessionId) this.app.switchActiveTerminal(this.activeSessionId);
                     else this.app.clearTerminalArea();
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    renderArchivedDropdown(event) {
        const oldMenu = document.getElementById('archived-dropdown');
        if (oldMenu) oldMenu.remove();

        const archivedSessions = this.sessions.filter(s => s.state === 'archived');
        if (archivedSessions.length === 0) return;

        const menu = document.createElement('div');
        menu.id = 'archived-dropdown';
        menu.className = 'absolute bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] z-50 flex flex-col py-1 min-w-[200px] max-h-[300px] overflow-y-auto';
        
        const rect = event.target.getBoundingClientRect();
        menu.style.right = \`\${window.innerWidth - rect.right}px\`;
        menu.style.top = \`\${rect.bottom + 5}px\`;

        archivedSessions.forEach(session => {
            const item = document.createElement('div');
            item.className = 'flex justify-between items-center px-4 py-2 hover:bg-gray-100 cursor-pointer';
            item.innerHTML = \`<span class="font-bold truncate">\${session.name}</span><button class="neo-btn-icon text-green-600 text-xl" title="Riprendi">↺</button>\`;
            item.addEventListener('click', () => this.resumeSession(session));
            menu.appendChild(item);
        });

        document.body.appendChild(menu);
        setTimeout(() => document.addEventListener('click', () => menu.remove(), {once: true}), 0);
    }

    async resumeSession(session) {
        try {
            const res = await fetch(\`/sessions/\${session.id}/resume\`, { method: 'PUT' });
            if (res.ok) {
                session.state = 'active';
                this.renderTabs();
                this.updateArchivedCount();
                this.activateTab(session.id);
            }
        } catch (err) {
            console.error(err);
        }
    }

    async renderNewSessionPicker() {
        if (!this.app.activeProjectId) {
            alert('Seleziona prima un progetto.');
            return;
        }

        const name = prompt('Nome della nuova sessione:', 'Nuova Sessione');
        if (!name) return;

        try {
            const res = await fetch(\`/projects/\${this.app.activeProjectId}/sessions\`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ name: name })
            });
            
            if (res.ok) {
                const newSession = await res.json();
                this.sessions.push(newSession);
                this.renderTabs();
                this.activateTab(newSession.id);
            }
        } catch (err) {
            console.error(err);
        }
    }
}

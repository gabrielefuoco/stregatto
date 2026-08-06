/**
 * static/js/view_tab_bar.js
 * Componente Tab Bar per gestire i terminali xterm.js con stile Neo-Brutalist
 */

import { apiFetch, createContextMenu, confirmModal, showToast } from './ui.js?v=13';

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
            <div class="tab-bar-wrapper flex bg-white w-full border-b-2 border-black p-2 items-center justify-between">
                <div id="tabs-container" class="flex-1 flex overflow-x-auto no-scrollbar items-center py-1 px-1 gap-2">
                    <!-- Tabs go here -->
                </div>
                <div class="tab-bar-actions flex items-center px-2 gap-2 bg-white shrink-0">
                    <button id="btn-archived" class="neo-btn-icon font-headline hover:bg-gray-200 p-1 font-bold text-xs uppercase" title="Sessioni Archiviate" style="display: none;">
                        📦 <span id="archived-count">0</span>
                    </button>
                    <button id="btn-new-session" class="neo-btn neo-btn-black neo-btn-sm">
                        + NUOVA SESSIONE
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
                if (session) {
                    createContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        items: [
                            { label: 'Rinomina', action: () => this.renameSession(session) },
                            { label: session.pinned ? 'Rimuovi Pin' : 'Fissa (Pin)', action: () => this.togglePin(session) },
                            { label: 'Sospendi', action: () => this.suspendSession(session) },
                            { label: 'Archivia', action: () => this.archiveSession(session) },
                            { label: 'Chiudi (Elimina)', action: () => this.closeTab(session.id), danger: true }
                        ]
                    });
                }
            }
        });

        this.container.querySelector('#btn-archived').addEventListener('click', (e) => {
            this.renderArchivedDropdown(e);
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
            if (Boolean(a.pinned) === Boolean(b.pinned)) return 0;
            return a.pinned ? -1 : 1;
        });

        sorted.forEach(session => {
            tabsContainer.appendChild(this.createTabElement(session));
        });
    }

    createTabElement(session) {
        const tab = document.createElement('div');
        const isActive = session.id === this.activeSessionId;
        
        tab.className = `tab-item flex items-center gap-2 px-3.5 py-1.5 border-2 border-black rounded-none cursor-pointer select-none transition-all group min-w-0 shrink-0 max-w-[220px] ${isActive ? 'active bg-black text-white font-bold shadow-[2px_2px_0px_#FF5F1F]' : 'bg-white text-black hover:bg-gray-100 shadow-[2px_2px_0px_#000]'}`;
        tab.dataset.id = session.id;

        tab.innerHTML = `
            ${session.pinned ? '<span class="text-xs shrink-0">📌</span>' : ''}
            <div class="flex-1 min-w-0 flex flex-col justify-center">
                <span class="font-headline font-bold truncate text-xs leading-tight">${session.name}</span>
            </div>
            ${!session.pinned ? `
                <button class="close-btn neo-btn-icon opacity-70 group-hover:opacity-100 hover:text-red-500 font-bold ml-1 text-xs shrink-0">✕</button>
            ` : ''}
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

        // HTML5 Drag & Drop
        tab.draggable = true;
        tab.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', session.id);
            tab.classList.add('opacity-50');
        });
        tab.addEventListener('dragend', () => {
            tab.classList.remove('opacity-50');
        });
        tab.addEventListener('dragover', (e) => {
            e.preventDefault();
            tab.style.borderLeftColor = '#FF5F1F';
        });
        tab.addEventListener('dragleave', () => {
            tab.style.borderLeftColor = '';
        });
        tab.addEventListener('drop', async (e) => {
            e.preventDefault();
            tab.style.borderLeftColor = '';
            const draggedSessionId = e.dataTransfer.getData('text/plain');
            if (draggedSessionId && draggedSessionId !== session.id) {
                const draggedIndex = this.sessions.findIndex(s => s.id === draggedSessionId);
                const targetIndex = this.sessions.findIndex(s => s.id === session.id);
                
                if (draggedIndex !== -1 && targetIndex !== -1) {
                    const draggedSession = this.sessions[draggedIndex];
                    this.sessions.splice(draggedIndex, 1);
                    this.sessions.splice(targetIndex, 0, draggedSession);
                    
                    this.sessions.forEach((s, idx) => {
                        s.tab_order = idx;
                        apiFetch(`/api/sessions/${s.id}`, {
                            method: 'PUT',
                            body: { tab_order: idx }
                        }).catch(err => console.error(err));
                    });
                    this.renderTabs();
                }
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

        await confirmModal({
            title: 'Chiudi Sessione',
            message: `Sei sicuro di voler chiudere e eliminare la sessione "${session.name}"?`,
            danger: true,
            onConfirm: async () => {
                try {
                    await apiFetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
                    this.sessions = this.sessions.filter(s => s.id !== sessionId);
                    
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

    async suspendSession(session) {
        try {
            await apiFetch(`/api/sessions/${session.id}/suspend`, { method: 'PUT' });
            session.state = 'suspended';
            this.renderTabs();
            if (this.activeSessionId === session.id) {
                const activeSessions = this.sessions.filter(s => s.state !== 'archived');
                this.activeSessionId = activeSessions.length > 0 ? activeSessions[activeSessions.length - 1].id : null;
                if (this.activeSessionId) this.app.switchActiveTerminal(this.activeSessionId);
                else this.app.clearTerminalArea();
            }
        } catch (err) {
            console.error(err);
        }
    }

    async archiveSession(session) {
        try {
            await apiFetch(`/api/sessions/${session.id}/archive`, { method: 'PUT' });
            session.state = 'archived';
            this.renderTabs();
            this.updateArchivedCount();
            if (this.activeSessionId === session.id) {
                const activeSessions = this.sessions.filter(s => s.state !== 'archived');
                this.activeSessionId = activeSessions.length > 0 ? activeSessions[activeSessions.length - 1].id : null;
                if (this.activeSessionId) this.app.switchActiveTerminal(this.activeSessionId);
                else this.app.clearTerminalArea();
            }
        } catch (err) {
            console.error(err);
        }
    }

    renderArchivedDropdown(event) {
        const archivedSessions = this.sessions.filter(s => s.state === 'archived');
        if (archivedSessions.length === 0) return;

        createContextMenu({
            x: event.clientX,
            y: event.clientY,
            items: archivedSessions.map(session => ({
                label: `↺ ${session.name}`,
                action: () => this.resumeSession(session)
            }))
        });
    }

    async resumeSession(session) {
        try {
            await apiFetch(`/api/sessions/${session.id}/resume`, { method: 'PUT' });
            session.state = 'active';
            this.renderTabs();
            this.updateArchivedCount();
            this.activateTab(session.id);
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
            const newSession = await apiFetch(`/api/projects/${this.app.activeProjectId}/sessions`, {
                method: 'POST',
                body: { name }
            });
            this.sessions.push(newSession);
            this.renderTabs();
            this.activateTab(newSession.id);
        } catch (err) {
            console.error(err);
        }
    }
}

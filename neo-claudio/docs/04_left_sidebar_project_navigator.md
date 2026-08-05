# Step 04 — Sidebar Sinistra: Navigatore Progetti

## 1. Obiettivo
Il Navigatore Progetti (Project Navigator) sostituirà la vecchia lista chat, fungendo da entry point principale per l'organizzazione del lavoro.
- I progetti sono raggruppati: prima i *pinned* (fissati in alto), seguiti dagli altri ordinati per attività recente.
- Ogni card progetto mostra: icona, nome, path (troncato), un badge per il mode (🟢 LOCAL / 🔵 CLOUD), e il counter delle sessioni attive.
- Un pulsante "+ Nuovo Progetto" apre un modal per la creazione.
- Un menu contestuale (context menu) sul progetto permette di: Modificare (Edit), Fissare/Rimuovere (Pin/Unpin), Cambiare Modalità (Change Mode), Eliminare (Delete).
- Il click su un progetto carica le sue sessioni nella Tab Bar.
- Una search bar permette di filtrare i progetti per nome.

## 2. File: static/js/view_projects_sidebar.js (NEW)

Ecco l'implementazione completa per la gestione della sidebar:

```javascript
/**
 * static/js/view_projects_sidebar.js
 * Gestisce la sidebar dei progetti con stile Neo-Brutalist
 */

class ProjectsSidebar {
    constructor(containerEl, app) {
        this.container = containerEl;
        this.app = app;
        this.projects = [];
        this.searchQuery = '';
        this.init();
    }

    async init() {
        this.renderShell();
        this.attachEventListeners();
        await this.loadProjects();
    }

    renderShell() {
        this.container.innerHTML = `
            <div class="sidebar-left flex flex-col h-full border-r-2 border-black bg-white">
                <div class="sidebar-header p-4 border-b-2 border-black flex justify-between items-center">
                    <h2 class="text-xl font-bold uppercase tracking-tight">Progetti</h2>
                    <button id="btn-collapse-sidebar" class="neo-btn-icon" title="Chiudi (Ctrl+B)">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                </div>
                <div class="sidebar-search p-3 border-b-2 border-black">
                    <input type="text" id="search-projects" 
                           class="w-full neo-input p-2 border-2 border-black" 
                           placeholder="Cerca progetti...">
                </div>
                <div id="projects-list" class="sidebar-content flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                    <!-- Project cards will be rendered here -->
                </div>
                <div class="sidebar-footer p-4 border-t-2 border-black">
                    <button id="btn-new-project" class="w-full neo-btn bg-brand-orange text-white py-2 font-bold uppercase hover:-translate-y-1 hover:shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all">
                        + Nuovo Progetto
                    </button>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        const searchInput = this.container.querySelector('#search-projects');
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderProjects();
        });

        const newBtn = this.container.querySelector('#btn-new-project');
        newBtn.addEventListener('click', () => this.renderNewProjectModal());

        const collapseBtn = this.container.querySelector('#btn-collapse-sidebar');
        collapseBtn.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-collapsed');
        });
        
        // Context menu delegation
        this.container.querySelector('#projects-list').addEventListener('contextmenu', (e) => {
            const card = e.target.closest('.project-card');
            if (card) {
                e.preventDefault();
                const projectId = card.dataset.id;
                const project = this.projects.find(p => p.id === projectId);
                if (project) this.renderProjectContextMenu(project, e);
            }
        });
    }

    async loadProjects() {
        try {
            const res = await fetch('/api/projects');
            this.projects = await res.json();
            this.renderProjects();
        } catch (error) {
            console.error("Failed to load projects", error);
        }
    }

    renderProjects() {
        const list = this.container.querySelector('#projects-list');
        list.innerHTML = '';
        
        let filtered = this.projects.filter(p => p.name.toLowerCase().includes(this.searchQuery));
        
        // Ordinamento: Pinned prima, poi recenti (assumendo updated_at)
        filtered.sort((a, b) => {
            if (a.is_pinned === b.is_pinned) {
                return new Date(b.updated_at) - new Date(a.updated_at);
            }
            return a.is_pinned ? -1 : 1;
        });

        filtered.forEach(project => {
            list.appendChild(this.createProjectCard(project));
        });
    }

    createProjectCard(project) {
        const card = document.createElement('div');
        card.className = `project-card p-3 border-2 border-black bg-white cursor-pointer relative transition-all hover:shadow-[4px_4px_0px_#FF5F1F] ${project.id === this.app.activeProjectId ? 'active' : ''}`;
        card.dataset.id = project.id;
        
        const modeBadgeColor = project.mode === 'LOCAL' ? 'bg-green-400' : 'bg-blue-400';
        
        card.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-2xl">${project.icon || '📁'}</span>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center">
                        <h3 class="font-bold truncate" title="${project.name}">
                            ${project.is_pinned ? '📌 ' : ''}${project.name}
                        </h3>
                        <span class="mode-badge text-xs font-bold px-2 py-0.5 border border-black ${modeBadgeColor}">
                            ${project.mode}
                        </span>
                    </div>
                    <p class="text-xs text-gray-600 truncate mt-1" title="${project.path}">${project.path}</p>
                </div>
            </div>
            ${project.active_sessions_count > 0 ? `<div class="absolute -top-2 -right-2 bg-brand-orange text-white text-xs font-bold w-5 h-5 flex items-center justify-center border-2 border-black rounded-full">${project.active_sessions_count}</div>` : ''}
        `;
        
        card.addEventListener('click', () => {
            this.app.selectProject(project.id);
            this.container.querySelectorAll('.project-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
        });

        return card;
    }

    renderNewProjectModal() {
        // Implementazione modal per creazione progetto
        const modalHtml = `
            <div id="new-project-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white border-4 border-black p-6 w-[400px] shadow-[8px_8px_0px_#FF5F1F]">
                    <h2 class="text-2xl font-bold uppercase border-b-2 border-black pb-2 mb-4">Nuovo Progetto</h2>
                    <form id="form-new-project" class="flex flex-col gap-4">
                        <div>
                            <label class="block font-bold mb-1">Nome</label>
                            <input type="text" name="name" class="w-full neo-input p-2 border-2 border-black" required>
                        </div>
                        <div>
                            <label class="block font-bold mb-1">Percorso (Path)</label>
                            <input type="text" name="path" class="w-full neo-input p-2 border-2 border-black" required>
                        </div>
                        <div>
                            <label class="block font-bold mb-1">Modalità</label>
                            <select name="mode" class="w-full neo-input p-2 border-2 border-black">
                                <option value="LOCAL">🟢 LOCALE</option>
                                <option value="CLOUD">🔵 CLOUD</option>
                            </select>
                        </div>
                        <div class="flex justify-end gap-3 mt-4">
                            <button type="button" class="btn-cancel neo-btn px-4 py-2 border-2 border-black font-bold">Annulla</button>
                            <button type="submit" class="neo-btn bg-brand-orange text-white px-4 py-2 border-2 border-black font-bold shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all">Crea</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('new-project-modal');
        
        modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
        modal.querySelector('#form-new-project').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            
            try {
                const res = await fetch('/api/projects', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data)
                });
                if (res.ok) {
                    modal.remove();
                    await this.loadProjects();
                }
            } catch (err) {
                console.error(err);
            }
        });
    }

    renderProjectContextMenu(project, event) {
        // Rimuovi vecchi menu se presenti
        const oldMenu = document.getElementById('context-menu');
        if (oldMenu) oldMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'context-menu';
        menu.className = 'fixed bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] z-50 flex flex-col py-1 min-w-[150px]';
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;

        const menuItems = [
            { label: 'Modifica', action: () => this.editProject(project.id) },
            { label: project.is_pinned ? 'Rimuovi Pin' : 'Fissa (Pin)', action: () => this.togglePin(project.id) },
            { label: 'Elimina', action: () => this.deleteProject(project.id), danger: true }
        ];

        menuItems.forEach(item => {
            const btn = document.createElement('button');
            btn.className = `text-left px-4 py-2 hover:bg-gray-100 font-bold ${item.danger ? 'text-red-600 hover:bg-red-50' : ''}`;
            btn.innerText = item.label;
            btn.addEventListener('click', () => {
                item.action();
                menu.remove();
            });
            menu.appendChild(btn);
        });

        document.body.appendChild(menu);

        // Chiudi click fuori
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    // Placeholder actions
    async togglePin(id) { /* PUT /projects/{id} */ }
    async editProject(id) { /* Apri modal modifica */ }
    async deleteProject(id) { /* DELETE /projects/{id} */ }
}
```

## 3. File: static/css/themes.css (MODIFIED)

Aggiungiamo le regole CSS specifiche per la Sidebar con stile Neo-Brutalist:

```css
/* Sidebar Navigatore Progetti */
.sidebar-left {
    width: 280px;
    transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

body.sidebar-collapsed .sidebar-left {
    margin-left: -280px; /* Nasconde la sidebar */
}

/* Effetti Project Card */
.project-card {
    transition: transform 0.2s, box-shadow 0.2s, border-left-width 0.2s;
}

.project-card:hover {
    transform: translateY(-2px);
    box-shadow: 4px 4px 0px #FF5F1F;
}

.project-card.active {
    border-left-width: 6px;
    border-left-color: #FF5F1F;
    background-color: #FAFAFA;
}

/* Badge Modalità */
.mode-badge {
    border-radius: 9999px;
    box-shadow: 1px 1px 0px rgba(0,0,0,1);
}

/* Input Styles */
.neo-input {
    outline: none;
    transition: box-shadow 0.2s;
}
.neo-input:focus {
    box-shadow: 3px 3px 0px #FF5F1F;
}
```

## 4. Integrazione con il Layout

La sidebar si integra in un CSS Grid globale per mantenere un layout solido:

```css
/* Main Application Layout */
.app-container {
    display: grid;
    grid-template-columns: 280px 1fr; /* sidebar + main content (tab bar + terminal) */
    grid-template-rows: 100vh;
    overflow: hidden;
}

body.sidebar-collapsed .app-container {
    grid-template-columns: 0px 1fr;
}
```

**Keyboard Shortcut:** 
Aggiungeremo in `app.js` un listener globale per `Ctrl+B` che toggla la classe `sidebar-collapsed` sul `body`.

## 5. File: static/js/app.js (MODIFIED)

Ecco come wire-up la sidebar al resto dell'applicazione:

```javascript
/**
 * static/js/app.js (Snippet)
 */
import { ProjectsSidebar } from './view_projects_sidebar.js';
import { TabBar } from './view_tab_bar.js';

class App {
    constructor() {
        this.activeProjectId = null;
        this.sidebar = new ProjectsSidebar(document.getElementById('sidebar-container'), this);
        this.tabBar = new TabBar(document.getElementById('tab-bar-container'), this);
        this.initGlobalHotkeys();
    }

    async selectProject(projectId) {
        if (this.activeProjectId === projectId) return;
        this.activeProjectId = projectId;
        
        // Fetch sessions for the project
        try {
            const res = await fetch(`/api/projects/${projectId}/sessions`);
            const sessions = await res.json();
            
            // Pass sessions to Tab Bar
            this.tabBar.loadSessions(sessions);
        } catch (error) {
            console.error("Error loading project sessions:", error);
        }
    }

    initGlobalHotkeys() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+B for Sidebar toggle
            if (e.ctrlKey && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                document.body.classList.toggle('sidebar-collapsed');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.stregattoApp = new App();
});
```

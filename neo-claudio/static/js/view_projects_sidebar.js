/**
 * static/js/view_projects_sidebar.js
 * Gestisce la sidebar dei progetti con stile Neo-Brutalist
 */

export class ProjectsSidebar {
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
            const res = await fetch('/projects');
            if (!res.ok) throw new Error('Network response was not ok');
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
                            ${project.pinned ? '📌 ' : ''}${project.name}
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
                        <div>
                            <label class="block font-bold mb-1">Icona (Emoji)</label>
                            <input type="text" name="icon" class="w-full neo-input p-2 border-2 border-black" placeholder="📁" value="📁">
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
                const res = await fetch('/projects', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data)
                });
                if (res.ok) {
                    modal.remove();
                    await this.loadProjects();
                } else {
                    console.error('Failed to create project');
                }
            } catch (err) {
                console.error(err);
            }
        });
    }

    renderProjectContextMenu(project, event) {
        const oldMenu = document.getElementById('context-menu');
        if (oldMenu) oldMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'context-menu';
        menu.className = 'fixed bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] z-50 flex flex-col py-1 min-w-[150px]';
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;

        const menuItems = [
            { label: 'Modifica', action: () => this.editProject(project.id) },
            { label: project.pinned ? 'Rimuovi Pin' : 'Fissa (Pin)', action: () => this.togglePin(project) },
            { label: 'Cambia Modalità', action: () => this.toggleMode(project) },
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

        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    async togglePin(project) {
        try {
            await fetch(`/projects/${project.id}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ pinned: !project.pinned })
            });
            await this.loadProjects();
        } catch(e) {
            console.error('Error toggling pin:', e);
        }
    }

    async toggleMode(project) {
        const newMode = project.mode === 'LOCAL' ? 'CLOUD' : 'LOCAL';
        try {
            await fetch(`/projects/${project.id}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ mode: newMode })
            });
            await this.loadProjects();
        } catch(e) {
            console.error('Error toggling mode:', e);
        }
    }

    async editProject(id) {
        const project = this.projects.find(p => p.id === id);
        if (!project) return;
        
        const modalHtml = `
            <div id="edit-project-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white border-4 border-black p-6 w-[400px] shadow-[8px_8px_0px_#FF5F1F]">
                    <h2 class="text-2xl font-bold uppercase border-b-2 border-black pb-2 mb-4">Modifica Progetto</h2>
                    <form id="form-edit-project" class="flex flex-col gap-4">
                        <div>
                            <label class="block font-bold mb-1">Nome</label>
                            <input type="text" name="name" class="w-full neo-input p-2 border-2 border-black" value="${project.name}" required>
                        </div>
                        <div>
                            <label class="block font-bold mb-1">Percorso (Path)</label>
                            <input type="text" name="path" class="w-full neo-input p-2 border-2 border-black" value="${project.path || ''}" required>
                        </div>
                        <div>
                            <label class="block font-bold mb-1">Modalità</label>
                            <select name="mode" class="w-full neo-input p-2 border-2 border-black">
                                <option value="LOCAL" ${project.mode === 'LOCAL' ? 'selected' : ''}>🟢 LOCALE</option>
                                <option value="CLOUD" ${project.mode === 'CLOUD' ? 'selected' : ''}>🔵 CLOUD</option>
                            </select>
                        </div>
                        <div>
                            <label class="block font-bold mb-1">Icona (Emoji)</label>
                            <input type="text" name="icon" class="w-full neo-input p-2 border-2 border-black" value="${project.icon || '📁'}">
                        </div>
                        <div class="flex justify-end gap-3 mt-4">
                            <button type="button" class="btn-cancel neo-btn px-4 py-2 border-2 border-black font-bold">Annulla</button>
                            <button type="submit" class="neo-btn bg-brand-orange text-white px-4 py-2 border-2 border-black font-bold shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all">Salva</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('edit-project-modal');
        
        modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
        modal.querySelector('#form-edit-project').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            
            try {
                const res = await fetch(`/projects/${id}`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data)
                });
                if (res.ok) {
                    modal.remove();
                    await this.loadProjects();
                } else {
                    console.error('Failed to update project');
                }
            } catch (err) {
                console.error(err);
            }
        });
    }

    async deleteProject(id) {
        if (!confirm('Sei sicuro di voler eliminare questo progetto?')) return;
        try {
            const res = await fetch(`/projects/${id}`, { method: 'DELETE' });
            if (res.ok) {
                if (this.app.activeProjectId === id) {
                    this.app.selectProject(null);
                }
                await this.loadProjects();
            }
        } catch (error) {
            console.error("Failed to delete project", error);
        }
    }
}

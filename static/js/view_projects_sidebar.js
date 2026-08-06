/**
 * static/js/view_projects_sidebar.js
 * Gestisce la sidebar dei progetti con stile Neo-Brutalist
 */

import { apiFetch, createContextMenu, createModal, renderFormField, renderBadge, confirmModal, bindSearchInput } from './ui.js?v=13';

export class ProjectsSidebar {
    constructor(containerEl, app) {
        this.container = containerEl;
        this.app = app;
        if (this.app) this.app.projectsSidebar = this;
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
            <div class="sidebar-left flex flex-col h-full border-r-2 border-black bg-[#fbfbfb]">
                <div class="sidebar-header p-4 border-b-2 border-black flex justify-between items-center bg-white">
                    <h2 class="text-xl font-headline font-bold uppercase tracking-tight text-[#1a1c1c]">Progetti</h2>
                    <button id="btn-collapse-sidebar" class="neo-btn-icon text-black hover:text-[#FF5F1F]" title="Chiudi (Ctrl+B)">
                        <span class="material-symbols-outlined">chevron_left</span>
                    </button>
                </div>
                <div class="sidebar-search p-3 bg-[#fbfbfb]">
                    <input type="text" id="search-projects" 
                           class="w-full neo-input p-2 font-headline text-sm font-semibold border-2 border-black shadow-[2px_2px_0px_#000] focus:shadow-[4px_4px_0px_#FF5F1F]" 
                           placeholder="Cerca progetti...">
                </div>
                <div id="projects-list" class="sidebar-content flex-1 overflow-y-auto p-3 pt-0 flex flex-col gap-3">
                    <!-- Project cards will be rendered here -->
                </div>
                <div class="sidebar-footer p-3 border-t-2 border-black bg-white flex flex-col gap-2">
                    <button id="btn-new-project" class="neo-btn neo-btn-orange neo-btn-md w-full">
                        + NUOVO PROGETTO
                    </button>
                    <div class="grid grid-cols-2 gap-2">
                        <button id="btn-agent-gallery" class="neo-btn neo-btn-white neo-btn-sm" title="Crea o Seleziona Agent (Ctrl+G)">
                            🤖 Agents
                        </button>
                        <button id="btn-open-settings" class="neo-btn neo-btn-white neo-btn-sm" title="Impostazioni Sistema">
                            ⚙️ Settings
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        bindSearchInput(this.container.querySelector('#search-projects'), (query) => {
            this.searchQuery = query;
            this.renderProjects();
        });

        this.container.querySelector('#btn-new-project').addEventListener('click', () => this.renderProjectModal());

        const agentGalleryBtn = this.container.querySelector('#btn-agent-gallery');
        if (agentGalleryBtn) {
            agentGalleryBtn.addEventListener('click', () => {
                if (this.app && this.app.showGallery) this.app.showGallery();
            });
        }

        const settingsBtn = this.container.querySelector('#btn-open-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                if (this.app && this.app.showSettings) this.app.showSettings();
            });
        }

        this.container.querySelector('#btn-collapse-sidebar').addEventListener('click', () => {
            if (this.app && this.app.leftDrawer) {
                this.app.leftDrawer.toggle();
            }
        });
        
        // Context menu delegation
        this.container.querySelector('#projects-list').addEventListener('contextmenu', (e) => {
            const card = e.target.closest('.project-card');
            if (card) {
                e.preventDefault();
                const project = this.projects.find(p => p.id === card.dataset.id);
                if (project) {
                    createContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        items: [
                            { label: 'Modifica', action: () => this.renderProjectModal(project) },
                            { label: project.pinned ? 'Rimuovi Pin' : 'Fissa (Pin)', action: () => this.togglePin(project) },
                            { label: 'Cambia Modalità', action: () => this.toggleMode(project) },
                            { label: 'Elimina', action: () => this.deleteProject(project.id), danger: true }
                        ]
                    });
                }
            }
        });
    }

    async loadProjects() {
        try {
            this.projects = await apiFetch('/api/projects');
            this.renderProjects();
        } catch (error) {
            console.error("Failed to load projects", error);
        }
    }

    renderProjects() {
        const list = this.container.querySelector('#projects-list');
        list.innerHTML = '';
        
        let filtered = this.projects.filter(p => p.name.toLowerCase().includes(this.searchQuery));
        
        filtered.sort((a, b) => {
            if (Boolean(a.pinned) === Boolean(b.pinned)) {
                return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
            }
            return a.pinned ? -1 : 1;
        });

        filtered.forEach(project => {
            list.appendChild(this.createProjectCard(project));
        });
    }

    createProjectCard(project) {
        const card = document.createElement('div');
        const isActive = project.id === this.app.activeProjectId;
        card.className = `project-card p-3 border-2 border-black cursor-pointer relative transition-all mb-1 ${isActive ? 'bg-[#FF5F1F] text-white shadow-[4px_4px_0px_#000] translate-x-[-2px] translate-y-[-2px]' : 'bg-white text-black shadow-[2px_2px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px]'}`;
        card.dataset.id = project.id;
        
        const badgeVariant = project.mode === 'LOCAL' 
            ? (isActive ? 'active' : 'local') 
            : (isActive ? 'active' : 'cloud');
        const badgeHtml = renderBadge({ text: project.mode, variant: badgeVariant });
        
        card.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-2xl shrink-0">${project.icon || '📁'}</span>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center gap-2">
                        <h3 class="font-headline font-bold text-sm truncate" title="${project.name}">
                            ${project.pinned ? '📌 ' : ''}${project.name}
                        </h3>
                        ${badgeHtml}
                    </div>
                    <p class="text-xs font-body ${isActive ? 'text-white/90' : 'text-gray-600'} truncate mt-1" title="${project.path}">${project.path}</p>
                </div>
            </div>
            ${project.active_sessions_count > 0 ? `<div class="absolute -top-2 -right-2 bg-black text-white text-xs font-headline font-bold w-5 h-5 flex items-center justify-center border-2 border-black rounded-none shadow-[2px_2px_0px_#000]">${project.active_sessions_count}</div>` : ''}
        `;
        
        card.addEventListener('click', () => {
            this.app.selectProject(project.id);
            this.container.querySelectorAll('.project-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
        });

        return card;
    }

    async togglePin(project) {
        try {
            await apiFetch(`/api/projects/${project.id}`, {
                method: 'PUT',
                body: { pinned: !project.pinned }
            });
            await this.loadProjects();
        } catch(e) {
            console.error('Error toggling pin:', e);
        }
    }

    async toggleMode(project) {
        const newMode = project.mode === 'LOCAL' ? 'CLOUD' : 'LOCAL';
        try {
            await apiFetch(`/api/projects/${project.id}`, {
                method: 'PUT',
                body: { mode: newMode }
            });
            await this.loadProjects();
        } catch(e) {
            console.error('Error toggling mode:', e);
        }
    }

    renderProjectModal(project = null) {
        const isEdit = !!project;
        const title = isEdit ? 'Modifica Progetto' : 'Nuovo Progetto';
        const btnText = isEdit ? 'Salva' : 'Crea';

        const contentHtml = [
            renderFormField({ label: 'Nome', name: 'name', value: isEdit ? project.name : '', required: true }),
            renderFormField({ label: 'Percorso (Path)', name: 'path', value: isEdit ? (project.path || '') : '', required: true }),
            renderFormField({
                label: 'Modalità', name: 'mode', type: 'select',
                value: isEdit ? project.mode : 'LOCAL',
                options: [
                    { value: 'LOCAL', label: '🟢 LOCALE' },
                    { value: 'CLOUD', label: '🔵 CLOUD' }
                ]
            }),
            renderFormField({ label: 'Icona (Emoji)', name: 'icon', value: isEdit ? (project.icon || '📁') : '📁', placeholder: '📁' })
        ].join('');

        createModal({
            id: isEdit ? 'edit-project-modal' : 'new-project-modal',
            title,
            btnText,
            contentHtml,
            onSubmit: async (data, formData, closeModal) => {
                try {
                    const url = isEdit ? `/api/projects/${project.id}` : '/api/projects';
                    const method = isEdit ? 'PUT' : 'POST';
                    await apiFetch(url, { method, body: data });
                    closeModal();
                    await this.loadProjects();
                } catch (err) {
                    console.error('Failed to save project', err);
                }
            }
        });
    }

    async deleteProject(id) {
        await confirmModal({
            title: 'Elimina Progetto',
            message: 'Sei sicuro di voler eliminare questo progetto e tutte le sue sessioni?',
            danger: true,
            onConfirm: async () => {
                try {
                    await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
                    if (this.app.activeProjectId === id) {
                        this.app.selectProject(null);
                    }
                    await this.loadProjects();
                } catch (error) {
                    console.error("Failed to delete project", error);
                }
            }
        });
    }
}


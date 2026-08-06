import { TerminalManager } from './terminal.js?v=13';
import { ProjectsSidebar } from './view_projects_sidebar.js?v=13';
import { TabBar } from './view_tab_bar.js?v=13';
import { AgentGallery } from './view_agent_gallery.js?v=13';
import { McpSidebar } from './view_mcp_sidebar.js?v=13';
import { SettingsView } from './view_settings.js?v=13';
import { apiFetch } from './ui.js?v=13';

class App {
    constructor() {
        this.activeProjectId = null;
        this.termManager = new TerminalManager();
        
        this.initMouseGlowEffect();
        this.initWorkspaceLayout();
        
        this.sidebar = new ProjectsSidebar(document.getElementById('sidebar-container'), this);
        this.tabBar = new TabBar(document.getElementById('workspace-header-container'), this);
        this.agentGallery = new AgentGallery(this);
        this.settingsView = new SettingsView(this);
        this.mcpSidebar = new McpSidebar(this);
        
        let mcpContainer = document.getElementById('mcp-sidebar-container');
        if (!mcpContainer) {
            mcpContainer = document.createElement('div');
            mcpContainer.id = 'mcp-sidebar-container';
            document.body.appendChild(mcpContainer);
        }
        this.mcpSidebar.init(mcpContainer);
        window.mcpSidebar = this.mcpSidebar;

        this.initGlobalHotkeys();
    }

    initMouseGlowEffect() {
        document.addEventListener('mousemove', (e) => {
            document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
            document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);

            const termWrapper = document.querySelector('.terminal-wrapper');
            if (termWrapper) {
                const rect = termWrapper.getBoundingClientRect();
                termWrapper.style.setProperty('--mouse-wrapper-x', `${e.clientX - rect.left}px`);
                termWrapper.style.setProperty('--mouse-wrapper-y', `${e.clientY - rect.top}px`);
            }
        });
    }

    initWorkspaceLayout() {
        const layout = document.querySelector('.app-layout');
        if (!layout) return;

        // Floating Card Workspace (Spacious & Chunky Soft Neo-Brutalist)
        layout.className = 'app-layout h-full flex flex-row bg-[#f0f0f0] bg-blueprint p-3 gap-3 font-body overflow-hidden';
        
        const sidebar = document.getElementById('sidebar-container');
        if (sidebar) {
            sidebar.className = 'sidebar-left h-full flex flex-col bg-white border-2 border-black shadow-[6px_6px_0px_#000] z-20 shrink-0';
        }
        
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.className = 'main-content flex-1 flex flex-col h-full overflow-hidden p-0 w-full';
        }

        const termWrapper = document.querySelector('.terminal-wrapper');
        if (termWrapper) {
            termWrapper.className = 'terminal-wrapper flex flex-col flex-grow relative bg-white border-2 border-black shadow-[6px_6px_0px_#000] rounded-none overflow-hidden';
        }
    }

    async selectProject(projectId) {
        this.showWorkspace();
        this.activeProjectId = projectId;
        if (this.projectsSidebar) {
            this.projectsSidebar.renderProjects();
        }
        
        try {
            let sessions = await apiFetch(`/api/projects/${projectId}/sessions`);
            if (!sessions || sessions.length === 0) {
                const newSession = await apiFetch(`/api/projects/${projectId}/sessions`, {
                    method: 'POST',
                    body: { name: 'Sessione 1' }
                });
                sessions = [newSession];
            }
            this.tabBar.loadSessions(sessions);
        } catch (error) {
            console.error("Error loading project sessions:", error);
        }
    }

    switchActiveTerminal(sessionId) {
        document.querySelectorAll('.terminal-container').forEach(el => el.style.display = 'none');
        
        let targetEl = document.getElementById(`term-${sessionId}`);
        if (!targetEl) {
            targetEl = document.createElement('div');
            targetEl.id = `term-${sessionId}`;
            targetEl.className = 'terminal-container h-full w-full relative';
            document.getElementById('terminal-area').appendChild(targetEl);
            
            const termViewport = document.createElement('div');
            termViewport.className = 'term-viewport-inner h-full w-full';
            targetEl.appendChild(termViewport);
            
            this.termManager.create(sessionId, termViewport);
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/pty/${sessionId}`;
            this.termManager.connect(sessionId, wsUrl);
        }
        
        targetEl.style.display = 'block';
        
        const term = this.termManager.getTerminal(sessionId);
        if (term) {
             const addons = this.termManager.addons.get(sessionId);
             if (addons && addons.fit) {
                 addons.fit.fit();
             }
             term.refresh(0, term.rows - 1);
             term.focus();
        }
    }

    clearTerminalArea() {
        document.querySelectorAll('.terminal-container').forEach(el => el.style.display = 'none');
    }

    switchView(targetView) {
        ['workspace', 'gallery', 'settings'].forEach(v => {
            const el = document.getElementById(`${v}-view`);
            if (!el) return;
            if (v === targetView) {
                el.classList.remove('hidden');
                el.classList.add('flex');
            } else {
                el.classList.remove('flex');
                el.classList.add('hidden');
            }
        });
    }

    showWorkspace() {
        this.switchView('workspace');
        if (this.tabBar && this.tabBar.activeSessionId) {
            const term = this.termManager.getTerminal(this.tabBar.activeSessionId);
            if (term) {
                const addons = this.termManager.addons.get(this.tabBar.activeSessionId);
                if (addons && addons.fit) {
                    addons.fit.fit();
                }
                term.focus();
            }
        }
    }

    showGallery() {
        const galleryView = document.getElementById('gallery-view');
        if (galleryView) this.agentGallery.render(galleryView);
        this.switchView('gallery');
    }

    showSettings() {
        const settingsView = document.getElementById('settings-view');
        if (settingsView) this.settingsView.render(settingsView);
        this.switchView('settings');
    }

    initGlobalHotkeys() {
        document.addEventListener('keydown', (e) => {
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

            if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                document.body.classList.toggle('sidebar-collapsed');
            } else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'g') {
                e.preventDefault();
                this.showGallery();
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.stregattoApp = new App();
});

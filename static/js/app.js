import { TerminalManager } from './terminal.js?v=30';
import { ProjectsSidebar } from './view_projects_sidebar.js?v=30';
import { TabBar } from './view_tab_bar.js?v=30';
import { AgentGallery } from './view_agent_gallery.js?v=30';
import { McpSidebar } from './view_mcp_sidebar.js?v=30';
import { SettingsView } from './view_settings.js?v=30';
import { apiFetch, DrawerController } from './ui.js?v=30';

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

        // Controllers parametrici DRY per i Drawer
        this.leftDrawer = new DrawerController({
            element: document.getElementById('sidebar-container'),
            width: '280px',
            direction: 'left',
            isOpen: true
        });

        this.rightDrawer = new DrawerController({
            element: document.getElementById('mcp-sidebar-container'),
            width: '360px',
            direction: 'right',
            isOpen: false
        });

        this.initGlobalHotkeys();
        this.renderEmptyWorkspace();
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
            sidebar.className = 'sidebar-left h-full flex flex-col z-20 shrink-0';
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

    renderEmptyWorkspace() {
        const area = document.getElementById('terminal-area');
        if (!area) return;

        document.querySelectorAll('.terminal-container').forEach(el => el.style.display = 'none');
        
        let welcomeEl = document.getElementById('welcome-hero-screen');
        if (!welcomeEl) {
            welcomeEl = document.createElement('div');
            welcomeEl.id = 'welcome-hero-screen';
            welcomeEl.className = 'w-full h-full flex flex-col items-center justify-center p-6 bg-transparent z-10 font-body select-none';
            welcomeEl.innerHTML = `
                <div class="bg-white border-2 border-black p-8 shadow-[6px_6px_0px_#1a1c1c] max-w-lg w-full text-center flex flex-col items-center gap-5 relative">
                    <!-- Retro Badge -->
                    <div class="absolute -top-4 bg-[#FF5F1F] text-white px-3 py-1 text-xs font-headline font-bold uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000]">
                        ⚡ Neo-Claudio CLI Studio
                    </div>

                    <div class="w-16 h-16 bg-[#FF5F1F] text-white border-2 border-black flex items-center justify-center text-3xl shadow-[3px_3px_0px_#000] mt-2">
                        🤖
                    </div>

                    <div class="space-y-1">
                        <h2 class="text-2xl font-headline font-bold uppercase tracking-tight text-[#1a1c1c]">Neo-Claudio Terminal</h2>
                        <p class="text-xs text-gray-600 font-medium">Interfaccia Web Multi-Sessione per Claude Code CLI</p>
                    </div>

                    <div class="w-full h-px bg-black my-1"></div>

                    <!-- Action Buttons -->
                    <div class="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
                        <button id="hero-btn-new-session" class="neo-btn neo-btn-orange neo-btn-md font-bold w-full sm:w-auto">
                            + NUOVA SESSIONE
                        </button>
                        <button id="hero-btn-gallery" class="neo-btn neo-btn-white neo-btn-md font-bold w-full sm:w-auto">
                            🤖 AGENT GALLERY
                        </button>
                    </div>

                    <!-- Shortcuts Cheatsheet -->
                    <div class="grid grid-cols-3 gap-2 w-full pt-3 text-[11px] font-headline font-bold">
                        <div class="bg-[#f9f9f9] border border-black p-2 flex flex-col items-center shadow-[1px_1px_0px_#000]">
                            <span class="bg-black text-white px-1 font-mono text-[10px] mb-1">Ctrl+B</span>
                            <span>PROGETTI</span>
                        </div>
                        <div class="bg-[#f9f9f9] border border-black p-2 flex flex-col items-center shadow-[1px_1px_0px_#000]">
                            <span class="bg-black text-white px-1 font-mono text-[10px] mb-1">Ctrl+E</span>
                            <span>MCP APPS</span>
                        </div>
                        <div class="bg-[#f9f9f9] border border-black p-2 flex flex-col items-center shadow-[1px_1px_0px_#000]">
                            <span class="bg-black text-white px-1 font-mono text-[10px] mb-1">Ctrl+G</span>
                            <span>GALLERY</span>
                        </div>
                    </div>
                </div>
            `;
            area.appendChild(welcomeEl);

            welcomeEl.querySelector('#hero-btn-new-session').addEventListener('click', () => {
                if (this.tabBar) this.tabBar.renderCreateSessionModal();
            });

            welcomeEl.querySelector('#hero-btn-gallery').addEventListener('click', () => {
                this.showGallery();
            });
        }

        welcomeEl.style.display = 'flex';
    }

    switchActiveTerminal(sessionId) {
        if (!sessionId) {
            this.renderEmptyWorkspace();
            return;
        }

        const welcomeEl = document.getElementById('welcome-hero-screen');
        if (welcomeEl) welcomeEl.style.display = 'none';

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
        this.renderEmptyWorkspace();
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
                if (this.leftDrawer) this.leftDrawer.toggle();
            } else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'e') {
                e.preventDefault();
                if (this.rightDrawer) this.rightDrawer.toggle();
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

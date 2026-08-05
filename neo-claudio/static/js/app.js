import { TerminalManager } from './terminal.js';
import { ProjectsSidebar } from './view_projects_sidebar.js';
import { TabBar } from './view_tab_bar.js';
import { AgentGallery } from './view_agent_gallery.js';
import { Toolbar } from './view_toolbar.js';
import { McpSidebar } from './view_mcp_sidebar.js';

class App {
    constructor() {
        this.activeProjectId = null;
        this.termManager = new TerminalManager();
        this.sidebar = new ProjectsSidebar(document.getElementById('sidebar-container'), this);
        this.tabBar = new TabBar(document.getElementById('tab-bar-container'), this);
        
        // Step 06 & 07 Components
        this.agentGallery = new AgentGallery();
        this.mcpSidebar = new McpSidebar();
        
        // Initialize MCP Sidebar if container exists, else we create one
        let mcpContainer = document.getElementById('mcp-sidebar-container');
        if (!mcpContainer) {
            mcpContainer = document.createElement('div');
            mcpContainer.id = 'mcp-sidebar-container';
            document.body.appendChild(mcpContainer);
        }
        this.mcpSidebar.init(mcpContainer);
        window.mcpSidebar = this.mcpSidebar; // for global shortcut

        this.initGlobalHotkeys();
    }

    async selectProject(projectId) {
        if (this.activeProjectId === projectId) return;
        this.activeProjectId = projectId;
        
        try {
            const res = await fetch(`/projects/${projectId}/sessions`);
            if (res.ok) {
                const sessions = await res.json();
                this.tabBar.loadSessions(sessions);
            }
        } catch (error) {
            console.error("Error loading project sessions:", error);
        }
    }

    switchActiveTerminal(sessionId) {
        // Nascondi tutti i container dei terminali
        document.querySelectorAll('.terminal-container').forEach(el => el.style.display = 'none');
        
        // Verifica se l'elemento terminale esiste, altrimenti crealo
        let targetEl = document.getElementById(`term-${sessionId}`);
        if (!targetEl) {
            targetEl = document.createElement('div');
            targetEl.id = `term-${sessionId}`;
            targetEl.className = 'terminal-container h-full w-full relative';
            document.getElementById('terminal-area').appendChild(targetEl);
            
            // Create toolbar container
            const toolbarContainer = document.createElement('div');
            toolbarContainer.id = `toolbar-${sessionId}`;
            targetEl.appendChild(toolbarContainer);
            
            // Create terminal viewport container
            const termViewport = document.createElement('div');
            termViewport.className = 'term-viewport-inner h-[calc(100%-48px)] w-full';
            targetEl.appendChild(termViewport);
            
            // Crea e connetti
            this.termManager.create(sessionId, termViewport);
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            // Prendi il token per auth
            const wsUrl = `${protocol}//${window.location.host}/ws/pty/${sessionId}?token=test`;
            this.termManager.connect(sessionId, wsUrl);
            
            // Render toolbar
            const toolbar = new Toolbar({ id: sessionId }, {
                sendData: (data) => {
                    const ws = this.termManager.websockets && this.termManager.websockets[sessionId];
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'input', data: data }));
                    }
                }
            });
            toolbar.render(toolbarContainer);
        }
        
        // Mostra quello richiesto
        targetEl.style.display = 'block';
        
        // Forza il resize di xterm.js
        const term = this.termManager.getTerminal(sessionId);
        if (term) {
             term.fitAddon.fit();
             term.refresh(0, term.rows - 1);
             term.focus();
        }
    }

    clearTerminalArea() {
        document.querySelectorAll('.terminal-container').forEach(el => el.style.display = 'none');
    }

    initGlobalHotkeys() {
        document.addEventListener('keydown', (e) => {
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

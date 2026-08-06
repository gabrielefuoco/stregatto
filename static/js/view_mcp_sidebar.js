import { apiFetch, showToast, BaseSidebarComponent } from './ui.js?v=30';

export class McpSidebar {
    constructor(apiClient) {
        this.api = apiClient;
        this.apps = [];
        this.activeAppId = null;
        this.isOpen = false;
        this.baseSidebar = null;
    }

    async init(containerEl) {
        this.container = containerEl;
        this.baseSidebar = new BaseSidebarComponent({
            containerEl: this.container,
            title: 'MCP APPS',
            icon: '⚡',
            width: '360px',
            direction: 'right'
        });
        await this.loadApps();
        this.render();
        this.setupPostMessageListener();
        
        // global shortcut
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
                e.preventDefault();
                this.toggleSidebar();
            }
        });
    }

    async loadApps() {
        try {
            const response = await apiFetch('/api/mcp/apps');
            this.apps = response.data || [];
        } catch (e) {
            console.error("Errore nel caricamento delle app MCP:", e);
        }
    }

    render() {
        this.baseSidebar.renderShell({
            searchHtml: `
                <div class="mcp-app-list border-b-2 border-black bg-[#fbfbfb] flex flex-wrap gap-2 p-3 shrink-0">
                    ${this.apps.map(app => `
                        <button class="btn-app-tab neo-btn neo-btn-white neo-btn-sm font-bold flex items-center gap-1.5 shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#FF5F1F]" data-appid="${app.id}" title="${app.description}">
                            <span class="text-base">${app.icon}</span> <span>${app.name}</span>
                        </button>
                    `).join('')}
                </div>
            `,
            contentHtml: `
                <div id="mcp-frame-container" class="flex-1 w-full h-full flex flex-col items-center justify-center bg-[#fbfbfb] p-2">
                    <div class="flex flex-col items-center justify-center font-headline text-xs uppercase tracking-wide font-bold p-6 text-center text-black bg-white border-2 border-black shadow-[4px_4px_0px_#000] max-w-[280px]">
                        <span class="text-4xl mb-3">🔌</span>
                        <p class="leading-relaxed">Seleziona un'app in alto per avviarla e connettere il server MCP.</p>
                    </div>
                </div>
            `
        });
        this.bindEvents();
    }

    bindEvents() {
        const closeBtn = this.container.querySelector('#btn-close-sidebar');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.toggleSidebar(false);
            });
        }

        this.container.querySelectorAll('.btn-app-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const appId = e.currentTarget.dataset.appid;
                this.openApp(appId);
            });
        });
    }

    openApp(appId) {
        this.activeAppId = appId;
        const app = this.apps.find(a => a.id === appId);
        if(!app) return;

        const container = this.container.querySelector('#mcp-frame-container');
        
        // Correzione prefisso API: se entrypoint è /mcp/.. aggiungiamo /api
        let srcUrl = app.entrypoint;
        if (srcUrl.startsWith('/mcp/')) {
            srcUrl = '/api' + srcUrl;
        }

        // Creazione Iframe con Sandboxing rigido
        container.innerHTML = `
            <iframe 
                src="${srcUrl}" 
                class="w-full h-full border-none"
                sandbox="allow-scripts allow-forms allow-same-origin"
                title="${app.name}">
            </iframe>
        `;

        // Dopo il caricamento, inviamo il contesto all'App
        const iframe = container.querySelector('iframe');
        iframe.onload = () => {
            iframe.contentWindow.postMessage({
                type: 'mcp-app-context',
                data: {
                    theme: 'neo-brutalist',
                    projectId: 'current_project_123'
                }
            }, '*'); // Sostituire '*' con origin esatto in prod
        };
    }

    closeApp() {
        const container = this.container.querySelector('#mcp-frame-container');
        container.innerHTML = '';
        this.activeAppId = null;
    }

    toggleSidebar(forceState = null) {
        if (window.stregattoApp && window.stregattoApp.rightDrawer) {
            if (forceState !== null) {
                window.stregattoApp.rightDrawer.setOpen(forceState);
            } else {
                window.stregattoApp.rightDrawer.toggle();
            }
        }
    }

    setupPostMessageListener() {
        window.addEventListener('message', (event) => {
            // Ignorare i messaggi non provenienti dall'Iframe o non di tipo mcp
            if(!event.data || !event.data.type || !event.data.type.startsWith('mcp-')) return;
            
            console.log("Messaggio ricevuto da MCP App:", event.data);
            
            switch(event.data.action) {
                case 'resize':
                    // Gestire il resize dell'app se necessario
                    break;
                case 'toast':
                    // Mostrare una notifica lato host
                    showToast(`MCP App: ${event.data.payload.message}`, 'info');
                    break;
            }
        });
    }
}

import { apiFetch, showToast } from './ui.js?v=13';

export class McpSidebar {
    constructor(apiClient) {
        this.api = apiClient;
        this.apps = [];
        this.activeAppId = null;
        this.isOpen = false;
    }

    async init(containerEl) {
        this.container = containerEl;
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
        // Layout della sidebar di destra come Floating Card (Opzione B)
        const html = `
            <div id="mcp-sidebar" class="sidebar-right neo-card-floating h-full w-[360px] flex flex-col z-20 shrink-0 ${this.isOpen ? 'flex' : 'hidden'}">
                
                <!-- Header -->
                <div class="h-14 border-b-2 border-black bg-white flex justify-between items-center px-4 shrink-0">
                    <h3 class="text-lg font-headline font-bold uppercase tracking-tight text-black">MCP APPS</h3>
                    <button id="btn-close-sidebar" class="neo-btn-icon font-headline font-bold text-xl hover:text-red-500" title="Chiudi">✕</button>
                </div>
                
                <!-- App List / Tabs -->
                <div class="mcp-app-list border-b-2 border-black bg-[#fbfbfb] flex flex-wrap gap-2 p-3 shrink-0">
                    ${this.apps.map(app => `
                        <button class="btn-app-tab neo-btn neo-btn-white neo-btn-sm" data-appid="${app.id}" title="${app.description}">
                            <span class="text-lg">${app.icon}</span> <span>${app.name}</span>
                        </button>
                    `).join('')}
                </div>

                <!-- Iframe Container -->
                <div id="mcp-frame-container" class="flex-grow relative bg-[#f0f0f0] bg-blueprint p-4 flex flex-col items-center justify-center">
                    <div class="flex flex-col items-center justify-center font-headline text-xs uppercase tracking-wide font-bold p-6 text-center text-black bg-white border-2 border-black shadow-[4px_4px_0px_#000] max-w-[280px]">
                        <span class="text-4xl mb-3">🔌</span>
                        <p class="leading-relaxed">Seleziona un'app in alto per avviarla e connettere il server MCP.</p>
                    </div>
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        this.bindEvents();
    }

    bindEvents() {
        this.container.querySelector('#btn-close-sidebar').addEventListener('click', () => {
            this.toggleSidebar(false);
        });

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
        this.isOpen = forceState !== null ? forceState : !this.isOpen;
        const sidebarEl = this.container.querySelector('#mcp-sidebar');
        
        if(this.isOpen) {
            sidebarEl.classList.remove('hidden');
            sidebarEl.classList.add('flex');
        } else {
            sidebarEl.classList.remove('flex');
            sidebarEl.classList.add('hidden');
        }
        
        // Dispatche un resize per aggiustare il terminale!
        setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
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

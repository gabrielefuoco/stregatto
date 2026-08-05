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
            let response;
            if (this.api && this.api.get) {
                response = await this.api.get('/mcp/apps');
            } else {
                const res = await fetch('/mcp/apps');
                response = await res.json();
            }
            this.apps = response.data || [];
        } catch (e) {
            console.error("Errore nel caricamento delle app MCP:", e);
        }
    }

    render() {
        // Layout della sidebar di destra, border-l-4 black per aderire a neo-brutalist
        const html = `
            <div id="mcp-sidebar" class="sidebar-right h-full w-[360px] bg-white border-l-4 border-black flex flex-col transition-transform duration-300 transform ${this.isOpen ? 'translate-x-0' : 'translate-x-full'} absolute right-0 top-0 bottom-0 z-20 shadow-[-4px_0_10px_rgba(0,0,0,0.1)]">
                
                <!-- Header -->
                <div class="h-12 border-b-4 border-black bg-[#FF5F1F] flex justify-between items-center px-4 shrink-0">
                    <h3 class="font-bold font-mono text-white uppercase tracking-wider">MCP Apps</h3>
                    <button id="btn-close-sidebar" class="text-white hover:text-black font-bold text-xl">✕</button>
                </div>
                
                <!-- App List / Tabs -->
                <div class="mcp-app-list border-b-4 border-black bg-yellow-50 flex gap-2 overflow-x-auto p-2 shrink-0">
                    ${this.apps.map(app => `
                        <button class="btn-app-tab neo-btn bg-white border-2 border-black px-2 py-1 text-sm font-bold flex items-center gap-1 min-w-max hover:bg-[#FF5F1F] hover:text-white" data-appid="${app.id}" title="${app.description}">
                            <span>${app.icon}</span> ${app.name}
                        </button>
                    `).join('')}
                </div>

                <!-- Iframe Container -->
                <div id="mcp-frame-container" class="flex-grow relative bg-gray-100">
                    <div class="absolute inset-0 flex items-center justify-center text-gray-500 font-mono text-sm p-4 text-center">
                        Seleziona un'app dalla barra superiore per avviarla.
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
        
        // Creazione Iframe con Sandboxing rigido
        container.innerHTML = `
            <iframe 
                src="${app.entrypoint}" 
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
            sidebarEl.classList.remove('translate-x-full');
        } else {
            sidebarEl.classList.add('translate-x-full');
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
                    alert(`MCP App: ${event.data.payload.message}`);
                    break;
            }
        });
    }
}

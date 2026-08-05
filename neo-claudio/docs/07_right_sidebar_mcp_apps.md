# Step 07 — Sidebar Destra: Pannello MCP Apps

Questo documento dettaglia l'implementazione della Sidebar Destra per il rendering delle **MCP Apps**, consentendo alle estensioni (MCP Servers) di esporre interfacce grafiche all'interno di Stregatto V3.

## 1. Obiettivo

- Costruire un pannello laterale (sidebar destra) in grado di renderizzare UI fornite dai server MCP.
- Le app vengono caricate in modo sicuro all'interno di iframe con attributo `sandbox`.
- La sidebar è collassabile e gestibile tramite scorciatoia da tastiera (Ctrl+E).
- Permettere una comunicazione fluida e sicura tra la shell principale (Host) e le App via API `window.postMessage`.

---

## 2. Architettura MCP Apps

I server Model Context Protocol (MCP) in Stregatto V3 non offrono solo tool da linea di comando o context resolvers, ma possono esporre vere e proprie web application (`application/mcp-app`).
Il flusso prevede:
1. All'avvio, il backend FastAPI richiede ai server MCP registrati la lista delle loro risorse.
2. Filtra le risorse di tipo `application/mcp-app`.
3. Il client frontend riceve l'elenco e popola la sidebar.
4. Quando l'utente seleziona un'App, questa viene caricata in un iframe sandboxed.
5. La comunicazione tra UI Host (Stregatto) e Iframe (MCP App) avviene scambiandosi payload JSON via `window.postMessage`.

```text
+-------------------+                          +---------------------+
| Stregatto Host UI | ===(window.postMessage)==| Iframe Sandboxed    |
| (Main Window)     |                          | (MCP App UI)        |
+-------------------+                          +---------------------+
        |                                                 |
        v                                                 v
  +-------------------------------------------------------------+
  | FastAPI Backend (Proxy / CORS bypass)                       |
  +-------------------------------------------------------------+
        |
        v
  +-------------------------------------------------------------+
  | MCP Server (Local Process, Docker, Remote API)              |
  +-------------------------------------------------------------+
```

---

## 3. Backend — File: `app/mcp_apps.py` (NEW)

Router FastAPI per fornire l'elenco delle app e fare da proxy alle loro risorse statiche, scavalcando problemi di CORS.

```python
# app/mcp_apps.py
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, HTMLResponse
import httpx

router = APIRouter(prefix="/mcp", tags=["mcp"])

# Mock database delle connessioni MCP
MCP_SERVERS = {
    "local_file_browser": {"url": "http://localhost:8001"},
    "git_diff_viewer": {"url": "http://localhost:8002"}
}

@router.get("/apps")
async def list_mcp_apps():
    """
    Ritorna la lista di applicazioni MCP disponibili,
    scansionando i server configurati.
    """
    # In una vera implementazione, invocherebbe il client MCP 
    # per richiedere `mcp.listResources()`. Qui forniamo un mock.
    apps = [
        {
            "id": "app-file-browser",
            "server": "local_file_browser",
            "name": "File Browser",
            "icon": "📁",
            "description": "Visualizza e gestisci i file del workspace",
            "entrypoint": "/mcp/apps/app-file-browser/proxy"
        },
        {
            "id": "app-git-diff",
            "server": "git_diff_viewer",
            "name": "Git Differ",
            "icon": "🌿",
            "description": "Anteprima delle modifiche git in corso",
            "entrypoint": "/mcp/apps/app-git-diff/proxy"
        }
    ]
    return JSONResponse(content={"status": "success", "data": apps})


@router.get("/apps/{app_id}/proxy")
async def proxy_mcp_app(app_id: str):
    """
    Funge da proxy per fornire i contenuti HTML/JS dell'MCP Server,
    evitando i blocchi CORS sul browser.
    """
    # Identifica il server associato
    app_map = {
        "app-file-browser": "local_file_browser",
        "app-git-diff": "git_diff_viewer"
    }
    
    server_id = app_map.get(app_id)
    if not server_id:
        raise HTTPException(status_code=404, detail="App non trovata")
        
    server_url = MCP_SERVERS[server_id]["url"]
    
    # Proxying the root HTML
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{server_url}/")
            return HTMLResponse(content=resp.text, status_code=resp.status_code)
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Errore di comunicazione col server MCP: {e}")

@router.get("/config")
async def get_mcp_config():
    # Ritorna la configurazione dei server MCP
    return {"servers": MCP_SERVERS}

@router.put("/config")
async def update_mcp_config(config: dict):
    # Aggiorna la configurazione (mock)
    global MCP_SERVERS
    MCP_SERVERS = config.get("servers", MCP_SERVERS)
    return {"status": "success"}
```

---

## 4. Frontend — File: `static/js/view_mcp_sidebar.js` (NEW)

Classe javascript responsabile del rendering della lista di applicazioni e della gestione degli Iframe.

```javascript
// static/js/view_mcp_sidebar.js

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
    }

    async loadApps() {
        try {
            const response = await this.api.get('/mcp/apps');
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
```

---

## 5. Predefined MCP Apps (Examples)

L'adozione delle UI tramite MCP permette alla piattaforma di delegare compiti visivi ai server che possiedono la vera logica. Esempi di implementazione reale:
1. **File Browser**: Navigazione ad albero, creazione ed eliminazione dei file.
2. **Git Diff Viewer**: Un editor side-by-side che evidenzia le modifiche apportate dall'agente LLM al codice sorgente.
3. **Database Explorer**: Griglia dati per esaminare i risultati di query generate e lanciate (utile se l'agente sta gestendo uno schema DB).
4. **Image Preview**: Gallery per i file grafici scaricati da WebFetch o generati da API di terze parti.
5. **Documentation Viewer**: Visualizzatore Markdown per la lettura di Readme e Reference ufficiali caricate nel contesto.

---

## 6. CSS for Right Sidebar

Aggiornamenti in `themes.css` per la Sidebar e l'integrazione del layout.

```css
/* themes.css Additions for Step 07 */

.sidebar-right {
    /* La larghezza e l'ombra sono configurate via Tailwind nell'HTML. */
    /* Qui aggiungiamo le personalizzazioni per scorrimento e scrollbar */
    will-change: transform;
}

.mcp-app-list::-webkit-scrollbar {
    height: 6px;
}
.mcp-app-list::-webkit-scrollbar-track {
    background: #fdfbf7; 
}
.mcp-app-list::-webkit-scrollbar-thumb {
    background: #000;
}

/* Modificatori Layout per Main Container */
/* La grid principale deve supportare 3 colonne quando le sidebar sono aperte */
#app-layout {
    display: grid;
    /* Struttura base. Se la sidebar-right è absolute, il grid può restare 2 colonne.
       Se vogliamo un layout fully-fluid: */
    grid-template-columns: auto 1fr auto;
    overflow: hidden;
    height: 100vh;
}
```

## 7. Layout Integration

Per la Sidebar Destra, a differenza del pannello laterale sinistro (che spinge il contenuto), si è scelto l'approccio *Overlay/Absolute* (o flex a comparsa). La scorciatoia da tastiera globale è gestita all'apice dell'applicazione (es. `main.js` o `AppLayout`):

```javascript
document.addEventListener('keydown', (e) => {
    // Ctrl+B o Cmd+B -> Toggle Left Sidebar
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        window.leftSidebar.toggleSidebar();
    }
    
    // Ctrl+E o Cmd+E -> Toggle Right Sidebar (MCP Apps)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        window.mcpSidebar.toggleSidebar();
    }
});
```

Questo pattern assicura che il terminale (o la galleria) rimangano il focus centrale dell'utente, dando la possibilità di invocare rapidamente app accessorie per compiti specializzati senza interrompere il workflow testuale.

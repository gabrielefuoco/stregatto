# Specifica Frontend (Il "Sandbox Proxy" MCP Apps)

> [!IMPORTANT] 
> **Context for Future Agents:** 
> Se stai leggendo questo file in una nuova sessione, il tuo compito è modificare la Chat UI di Stregatto (Vanilla JS o React) per renderla un **Host** compatibile con le MCP Apps (SEP-1865). Questa implementazione si ispira pesantemente all'esempio `basic-host` e alle logiche esposte nella skill `convert-web-app` del protocollo ufficiale.

La Chat UI non si limiterà più a parsare markdown testuale, ma diventerà una piattaforma in grado di iniettare dinamicamente Micro-Frontend (Micro-Apps) senza rompere lo stile globale o esporre a falle XSS.

## 1. Riconoscimento e Fetch della Risorsa UI (L'Evento Out-of-Band)

Il Backend non invia i pesanti dati UI all'interno del normale blocco testuale della chat. Li trasmette su un canale separato.

### Il Listener Frontend
L'app client di Stregatto deve istituire un listener su una propria connessione WebSocket (o SSE se Stregatto usa streaming text) dedicato agli eventi asincroni:
- **Trigger:** Ricezione di un messaggio con `{ "type": "app_launch", "uri": "ui://excalidraw...", "structured_content": {...} }`.
- **Azione:** Quando questo evento scatta, il frontend deve:
  1. Mostrare un indicatore di caricamento nella chat ("Caricamento App in corso...").
  2. Eseguire una HTTP GET verso l'endpoint REST del Backend che interroga il server MCP (es. `GET /api/mcp/read_resource?uri=...`).
  3. Recuperare l'HTML, servito strettamente con `text/html;profile=mcp-app`.

## 2. Architettura della Sandbox e CSP Infrangibile

Iniettare HTML sconosciuto nel DOM principale è fuori discussione. L'HTML deve finire in un Iframe blindato.

### Il Contratto CSP
L'oggetto JSON della UI resource (`_meta.ui`) contiene spesso chiavi come `connectDomains`, `resourceDomains`, e `frameDomains`.
Il frontend deve costruire dinamicamente un Iframe usando l'attributo `srcdoc` (o un `Blob URL`) e applicare le sandbox restrictions:

```html
<iframe 
    sandbox="allow-scripts allow-same-origin allow-forms allow-downloads" 
    srcdoc="...HTML dal server..."
    style="width: 100%; min-height: 500px; border: none; border-radius: 8px;">
</iframe>
```
*Nota sulla Sicurezza:* L'attributo `allow-same-origin` è solitamente necessario perché l'app interna deve poter accedere al proprio storage locale o manipolare canvas complessi. La protezione deriva dal fatto che l'app, viaggiando come blob senza dominio radice originario, viene trattata come `null` origin o origin opaco dal browser, rendendo il CSP vitale.

## 3. Il Bridge `PostMessageTransport`

Le MCP Apps (grazie all'SDK `ext-apps/client`) usano internamente `window.parent.postMessage` per provare a chiamare i tool o interagire col server.
La Chat UI deve intercettare questi messaggi, aprirsi una propria connessione WebSocket verso il Proxy JSON-RPC (definito in `02_backend_proxy_websocket.md`), e smistarli avanti e indietro.

### Implementazione del Router Lato Host
```javascript
class MCPHostProxy {
    constructor(iframeElement, wsUrl) {
        this.iframe = iframeElement;
        // WS Endpoint es. ws://localhost/ws/mcp-proxy/excalidraw
        this.ws = new WebSocket(wsUrl); 

        // Inbound: Dal Backend (Server MCP) -> verso l'Iframe
        this.ws.onmessage = (event) => {
            const rpcMessage = JSON.parse(event.data);
            
            // Assicurati che l'iframe sia pronto a ricevere
            if(this.iframe.contentWindow) {
                // L'SDK App.ts si aspetta messaggi JSON-RPC
                this.iframe.contentWindow.postMessage(rpcMessage, '*');
            }
        };

        // Outbound: Dall'Iframe (Client MCP App) -> verso il Backend
        window.addEventListener('message', this.handleIframeMessage.bind(this));
    }

    handleIframeMessage(event) {
        // SICUREZZA ASSOLUTA: Scarta tutto ciò che non viene dal nostro iframe
        if (event.source !== this.iframe.contentWindow) return;

        // Se il websocket è pronto, spara l'RPC request al backend
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(event.data));
        } else {
            console.error("Tentativo di invio RPC ma proxy WebSocket è disconnesso.");
            // Logica opzionale di queuing
        }
    }
}
```

## 4. Iniezione e Theme Sync (L'Host Context)
Le MCP Apps sono pensate per sembrare native. Appena il WebSocket è aperto e l'Iframe ha caricato (si può usare un handshake custom o aspettare un messaggio `app_ready`), il Frontend di Stregatto dovrebbe notificare il cambio di contesto all'App.

**Payload Inbound verso l'Iframe:**
```json
{
  "jsonrpc": "2.0",
  "method": "ui/notifications/host-context-changed",
  "params": {
    "theme": {
      "mode": "dark",
      "colors": {
        "--color-background-primary": "#1e1e1e",
        "--color-text-primary": "#ffffff",
        "--font-sans": "'Inter', sans-serif"
      }
    }
  }
}
```
In questo modo, quando crei una mappa su Excalidraw, avrà lo sfondo scuro se Stregatto è in Dark Mode, e il font si uniformerà alla UI circostante.

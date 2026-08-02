# Specifica Backend (Bridge & Proxy per MCP Apps)

> [!IMPORTANT] 
> **Context for Future Agents:** 
> Se stai leggendo questo file in una nuova sessione, il tuo compito è modificare il plugin `mcp_client` di Stregatto (Python/FastAPI) per supportare le MCP Apps. Stregatto usa `fastmcp` (e le classi sottostanti) come wrapper. L'obiettivo primario è non alterare la memoria dell'LLM (Cat) con payload JSON massivi, usando il paradigma Out-of-Band.

## 1. Handshake e Capability Negotiation (`plugins/mcp_client/config.py`)

Lo standard MCP Apps definisce che i server usano `getUiCapability(clientCapabilities)` per capire se possono fornire risorse `ui://`.
Se il client (Stregatto) non annuncia questa capability nell'`InitializeRequest`, il server opererà in modalità puramente testuale.

**Implementazione:**
Dato che Stregatto usa `fastmcp`, bisogna intercettare il momento in cui viene costruito il client sottostante e aggiungere alla mappa delle capabilities la chiave `io.modelcontextprotocol/ui`:
```python
# Nel punto in cui viene istanziata la sessione MCP
client_capabilities = {
    "roots": {"listChanged": True},
    "io.modelcontextprotocol/ui": {} # <-- Da iniettare
}
```
*Se `fastmcp` non espone un argomento diretto per iniettare capability custom, sarà necessario monkey-patchare o fare override del parametro `capabilities` durante il lifecycle asincrono di `Client.connect()`.*

## 2. Il Problema della Memoria e l'Approccio "Out-of-Band" (`plugins/mcp_client/manager.py`)

I tool UI MCP restituiscono un payload JSON che contiene il campo `structuredContent`. 
```json
{
  "content": [{"type": "text", "text": "App lanciata"}],
  "structuredContent": { "data": "Dati enormi per la UI" }
}
```

### Il Rischio (Context Saturation)
Stregatto memorizza l'history nei log dell'agente (`task.messages`). Passare il campo `structuredContent` come stringa di ritorno del tool distruggerebbe la Context Window del LLM.

### La Soluzione Out-of-Band
Nel file `manager.py`, all'interno della funzione (o metodo) `execute_tool`:
1. **Filtro Testuale:** Estrai il blocco testuale (`content` filtrato per `type == "text"`) e restituiscilo normalmente. Questo è ciò che vedrà l'agente.
2. **Push WebSocket:** Identifica la connessione WebSocket associata alla sessione utente attiva e invia direttamente al Frontend l'oggetto `structuredContent` unito all'uri identificativo dell'app.

```python
# Pseudo-codice per manager.py
if hasattr(result, "structuredContent") and result.structuredContent:
    # 1. Recupera l'URI dal _meta (dipende dallo schema MCP SDK esatto)
    ui_uri = extract_ui_uri_from_meta(result)
    
    # 2. Invia l'evento asincrono (fire & forget) al socket
    await emit_websocket_event({
        "type": "app_launch",
        "server_name": server_name,
        "uri": ui_uri,
        "structured_content": result.structuredContent
    })

# Ritorna sempre e solo il testo all'agente!
return text_fallback_string
```

## 3. L'Endpoint WebSocket (Il Proxy JSON-RPC)

Per funzionare, la UI nel browser deve dialogare in JSON-RPC con il server MCP (che gira in background collegato a Stregatto via `stdio` o `HTTP`). La Chat UI non può parlare `stdio` col server, quindi Stregatto deve fare da Router bidirezionale.

### Registrazione della Route tramite Hook FastAPI
La documentazione di Stregatto stabilisce che il modo più pulito e performante per registrare api custom di basso livello (bypassando le route di chat classiche) è l'hook `before_cat_bootstrap`.

Crea un file `endpoints.py` (o aggiungi in `hooks.py`) nel plugin `mcp_client`:
```python
from cat.ambient import hook
from fastapi import WebSocket, WebSocketDisconnect
import json
import asyncio

@hook
def before_cat_bootstrap(app):
    @app.websocket("/ws/mcp-proxy/{server_name}")
    async def mcp_proxy(websocket: WebSocket, server_name: str):
        await websocket.accept()
        
        # Recupera il client MCP vivo e connesso
        # (Assumi che MCPManager o equivalente detenga l'istanza Client)
        mcp_client = get_active_client(server_name)
        if not mcp_client:
            await websocket.close(code=1008)
            return

        async def forward_to_mcp():
            try:
                while True:
                    data = await websocket.receive_text()
                    rpc_message = json.loads(data)
                    # Traduci il payload nell'invio della richiesta/notifica
                    # al client MCP sottostante (session.send_request ecc.)
                    await mcp_client.session.send_raw_request(rpc_message)
            except WebSocketDisconnect:
                pass

        async def forward_to_frontend():
            # Iscrizione all'Event Bus o Event Emitter del client MCP
            # per catturare messaggi asincroni (es. on_notification)
            # e inoltrarli con websocket.send_text(...)
            pass

        # Esegui i task simultaneamente finché uno non cade
        await asyncio.gather(
            forward_to_mcp(),
            forward_to_frontend()
        )
```

### Gestione dei Fallimenti e Concurrency
Il proxy WebSocket deve gestire con robustezza la caduta della connessione. Se l'utente chiude la finestra del browser, l'eccezione `WebSocketDisconnect` deve abbattere in modo pulito il task asincrono senza intaccare il processo del Server MCP (che deve rimanere vivo per turni successivi).

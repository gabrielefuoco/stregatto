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

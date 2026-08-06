import os
import json
import logging
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Body, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import asyncio

from .pty_manager import pty_manager, build_claude_command

# Carica variabili d'ambiente dalla radice del repo
root_env = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(root_env)


from .db import init_db, UserSettingsDB
from .auth import get_current_user, AuthUser

from .projects import router as projects_router
from .sessions import router as sessions_router
from .presets import router as presets_router
from .db import seed_default_presets

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stregatto_v3.main")

app = FastAPI(title="Neo-Claudio API", version="3.0.0")

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inizializza DB all'avvio
@app.on_event("startup")
async def startup_event():
    await init_db()
    await seed_default_presets("system")
    logger.info("Neo-Claudio Database inizializzato con successo e preset di default caricati.")



@app.on_event("shutdown")
async def shutdown_event():
    await pty_manager.kill_all()
    logger.info("PTYManager shutdown complete.")

# Includi le rotte API
app.include_router(projects_router)
app.include_router(sessions_router)
app.include_router(presets_router)


# --- ENDPOINTS CORE ---

@app.get("/settings")
async def get_settings(current_user: AuthUser = Depends(get_current_user)):
    """Restituisce le impostazioni dell'utente (OpenRouter Key, Modello, Mode)."""
    user_settings = await UserSettingsDB.objects().where(UserSettingsDB.user_id == current_user.id).first()
    
    openrouter_key = user_settings.openrouter_key if user_settings else os.environ.get("OPENROUTER_API_KEY", "")
    mode = user_settings.mode if user_settings else "cloud"
    default_model = user_settings.default_model if user_settings else "poolside/laguna-s-2.1:free"

    return {
        "settings": [
            {
                "id": "neo_claudio_config",
                "name": "Configurazione Neo-Claudio & OpenRouter",
                "slug": "neo_claudio_config",
                "schema": {
                    "properties": {
                        "openrouter_key": {
                            "title": "OpenRouter API Key",
                            "type": "string",
                            "description": "Inserisci la tua API Key di OpenRouter (es. sk-or-v1-...)"
                        },
                        "default_model": {
                            "title": "Modello di Default",
                            "type": "string",
                            "description": "Es. poolside/laguna-s-2.1:free, anthropic/claude-3.5-sonnet"
                        },
                        "mode": {
                            "title": "Modalità di Esecuzione",
                            "type": "string",
                            "enum": ["cloud", "local"],
                            "description": "cloud = Docker VPS, local = PC locale via Tailscale"
                        }
                    }
                },
                "value": {
                    "openrouter_key": openrouter_key,
                    "default_model": default_model,
                    "mode": mode
                }
            }
        ]
    }


@app.put("/settings/{setting_id}")
async def update_settings(
    setting_id: str,
    payload: dict = Body(...),
    current_user: AuthUser = Depends(get_current_user)
):
    """Aggiorna le impostazioni dell'utente."""
    user_settings = await UserSettingsDB.objects().where(UserSettingsDB.user_id == current_user.id).first()
    if not user_settings:
        user_settings = UserSettingsDB(user_id=current_user.id)

    for k, v in payload.items():
        if hasattr(user_settings, k) and k not in ["id", "user_id", "created_at"]:
            setattr(user_settings, k, v)

    await user_settings.save()
    return {"status": "success", "settings": payload}



@app.post("/uploads")
async def upload_file(
    file: UploadFile = File(...),
    current_user: AuthUser = Depends(get_current_user)
):
    """Caricamento di file binari o documenti con sanitizzazione path."""
    upload_dir = Path("data/uploads") / current_user.id
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_filename = Path(file.filename).name
    file_path = upload_dir / safe_filename
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    return {
        "name": safe_filename,
        "url": f"/uploads/{current_user.id}/{safe_filename}",
        "size": len(content)
    }


def _load_json_file(file_path: Path) -> dict:
    if file_path.exists():
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Errore lettura {file_path.name}: {e}")
    return {}


def get_claude_code_mcp_servers():
    """Legge dinamicamente le configurazioni dei server MCP e plugin di Claude Code dal filesystem dell'utente."""
    home = Path.home()
    servers = {}

    # 1. Claude Desktop Config
    cfg = _load_json_file(home / "AppData" / "Roaming" / "Claude" / "claude_desktop_config.json")
    for name, s_cfg in cfg.get("mcpServers", {}).items():
        args = s_cfg.get("args", [])
        cmd_str = s_cfg.get("command", "") + (" " + " ".join(args) if isinstance(args, list) else "")
        servers[name] = {"name": name, "source": "Claude Desktop Config", "command": cmd_str, "status": "Configurato"}

    # 2. Claude Code Global Config (~/.claude.json)
    cfg = _load_json_file(home / ".claude.json")
    for name, s_cfg in cfg.get("mcpServers", {}).items():
        servers[name] = {"name": name, "source": "Claude Code Global (.claude.json)", "command": s_cfg.get("command", ""), "status": "Configurato"}
    for p_path, p_cfg in cfg.get("projects", {}).items():
        if isinstance(p_cfg, dict):
            for name, s_cfg in p_cfg.get("mcpServers", {}).items():
                servers[name] = {"name": name, "source": f"Project ({Path(p_path).name})", "command": s_cfg.get("command", ""), "status": "Configurato"}

    # 3. Claude Code Settings Plugins (~/.claude/settings.json)
    cfg = _load_json_file(home / ".claude" / "settings.json")
    for plugin_id, enabled in cfg.get("enabledPlugins", {}).items():
        if enabled:
            name = plugin_id.split("@")[0]
            servers[name] = {"name": name, "source": "Claude Code Plugin", "command": "Plugin Integrato", "status": "Attivo"}

    return list(servers.values())


@app.get("/api/mcp/servers")
async def list_mcp_servers():
    """Restituisce l'elenco dinamico dei server MCP letti direttamente dalle configurazioni di Claude Code."""
    servers = get_claude_code_mcp_servers()
    return {"data": servers}


@app.get("/api/mcp/apps")
async def list_mcp_apps():
    """Elenco dinamico delle MCP App (Micro-Frontend) basato sui server MCP attivi in Claude Code."""
    servers = get_claude_code_mcp_servers()
    apps = []
    
    for s in servers:
        name = s["name"]
        apps.append({
            "id": f"app-{name}",
            "name": name.replace("-", " ").title(),
            "icon": "⚡",
            "description": f"Interfaccia visiva per il server MCP '{name}' ({s['source']}).",
            "entrypoint": f"/api/mcp/apps/{name}"
        })
        
    return {"data": apps}

@app.websocket("/ws/pty/{session_id}")
async def pty_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()
    
    token = websocket.query_params.get("token")
    from .auth import get_token_user
    current_user = await get_token_user(token)
    
    # Recuperiamo la sessione dal DB se esiste per applicare il preset ed eventuale --resume
    from .db import SessionDB, AgentPresetDB, ProjectDB, UserSettingsDB
    session_db = await SessionDB.objects().get(SessionDB.id == session_id)
    preset = {"dangerously_skip_permissions": True, "env_vars": {}}
    cwd = "."
    
    if session_db:
        if session_db.user_id != current_user.id and current_user.id != "local_dev_user":
            logger.error(f"Unauthorized WebSocket access: Session user {session_db.user_id} != Auth user {current_user.id}")
            await websocket.close(code=1008)
            return

        project_db = await ProjectDB.objects().get(ProjectDB.id == session_db.project_id)
        if project_db and project_db.path and os.path.exists(project_db.path):
            cwd = project_db.path
            
        if session_db.preset_id:
            preset_db = await AgentPresetDB.objects().get(AgentPresetDB.id == session_db.preset_id)
            if preset_db:
                preset.update({
                    "model": session_db.model or preset_db.model,
                    "system_prompt": preset_db.system_prompt,
                    "permission_mode": preset_db.permission_mode,
                    "allowedTools": preset_db.allowed_tools,
                    "env_vars": preset_db.env_vars or {}
                })
        
        # Inject resume identifiers
        # Read from context safely
        context_dict = session_db.context if isinstance(session_db.context, dict) else {}
        has_been_spawned = context_dict.get("has_been_spawned", False)
        
        if has_been_spawned:
            preset["resume_id"] = session_db.claude_session_id or session_db.id
        else:
            preset["session_id"] = session_db.claude_session_id or session_db.id
                
        user_settings = None
        try:
            user_settings = await UserSettingsDB.objects().get(UserSettingsDB.user_id == session_db.user_id)
        except Exception:
            pass

        openrouter_key = (user_settings.openrouter_key if user_settings else None) or os.environ.get("OPENROUTER_API_KEY")
        

        if openrouter_key:
            preset["env_vars"]["OPENROUTER_API_KEY"] = openrouter_key
            preset["env_vars"]["ANTHROPIC_BASE_URL"] = "https://openrouter.ai/api"
            preset["env_vars"]["ANTHROPIC_AUTH_TOKEN"] = openrouter_key
            preset["env_vars"]["ANTHROPIC_API_KEY"] = ""
            
    cmd, env = build_claude_command(preset, cwd)
    
    session = pty_manager.sessions.get(session_id)
    if not session:
        session = await pty_manager.spawn(session_id, cmd, cwd, env, cols=120, rows=40)
        
        if not has_been_spawned:
            try:
                context = session_db.context if isinstance(session_db.context, dict) else {}
                context["has_been_spawned"] = True
                session_db.context = context
                await session_db.save()
            except Exception as e:
                logger.error(f"Error saving context: {e}")
        
    async def read_pty():
        try:
            while True:
                data = await pty_manager.read(session_id, 4096)
                if not data:
                    # Verifica se il processo è realmente morto
                    if session and session.process:
                        is_alive = True
                        if hasattr(session.process, "isalive"):
                            is_alive = session.process.isalive()
                        elif hasattr(session.process, "poll"):
                            is_alive = (session.process.poll() is None)
                        if not is_alive:
                            await websocket.send_json({"type": "exit", "code": 0})
                            break
                    await asyncio.sleep(0.02)
                    continue
                await websocket.send_bytes(data)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error reading from PTY: {e}")

    async def write_pty():
        try:
            while True:
                message = await websocket.receive()
                if "text" in message:
                    try:
                        msg = json.loads(message["text"])
                    except json.JSONDecodeError:
                        continue
                        
                    msg_type = msg.get("type")
                    if msg_type == "resize":
                        await pty_manager.resize(session_id, msg.get("cols", 80), msg.get("rows", 24))
                    elif msg_type == "ping":
                        await websocket.send_json({"type": "pong"})
                elif "bytes" in message:
                    await pty_manager.write(session_id, message["bytes"])
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected for session {session_id}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error writing to PTY: {e}")

    read_task = asyncio.create_task(read_pty())
    write_task = asyncio.create_task(write_pty())
    
    done, pending = await asyncio.wait(
        [read_task, write_task],
        return_when=asyncio.FIRST_COMPLETED
    )
    
    for task in pending:
        task.cancel()


# --- STATIC FILES (Canvas UI) ---
static_path = Path(__file__).parent.parent / "static"
if static_path.exists():
    app.mount("/static", StaticFiles(directory=static_path), name="static")

    @app.get("/canvas", include_in_schema=False)
    @app.get("/", include_in_schema=False)
    async def serve_index():
        return FileResponse(static_path / "index.html")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)

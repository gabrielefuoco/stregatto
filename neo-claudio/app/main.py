import os
import json
import logging
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Body, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import base64
import asyncio

from .pty_manager import pty_manager, build_claude_command

# Carica variabili d'ambiente dalla radice del repo
root_env = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(root_env)


from .db import init_db, UserSettingsDB
from .auth import get_current_user, AuthUser

from .projects import router as projects_router
from .sessions import router as sessions_router
from .presets import router as presets_router
from .mcp_apps import router as mcp_apps_router
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
app.include_router(mcp_apps_router)


# --- ENDPOINTS CORE ---

@app.get("/canvas/config")
async def canvas_config():
    """Configurazione pubblica per Supabase usata dalla Canvas UI."""
    return {
        "SUPABASE_URL": os.environ.get("SUPABASE_URL", ""),
        "SUPABASE_ANON_KEY": os.environ.get("SUPABASE_ANON_KEY", "")
    }


@app.get("/agents")
async def get_agents():
    """Ritorna l'agente attivo per la Canvas UI."""
    return {
        "agents": [
            {
                "slug": "default",
                "name": "Stregatto V3 Agent",
                "description": "Powered by Claude Code & OpenRouter"
            }
        ]
    }


@app.get("/llms")
async def get_llms():
    """Ritorna i modelli selezionabili."""
    return [
        {"id": "poolside/laguna-s-2.1:free", "name": "Laguna S 2.1 (Free)"},
        {"id": "anthropic/claude-3.5-sonnet", "name": "Claude 3.5 Sonnet"},
        {"id": "deepseek/deepseek-r1", "name": "DeepSeek R1"}
    ]



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
                "id": "stregatto_config",
                "name": "Configurazione Stregatto V3 & OpenRouter",
                "slug": "stregatto_config",
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

    if "openrouter_key" in payload:
        user_settings.openrouter_key = payload["openrouter_key"]
    if "default_model" in payload:
        user_settings.default_model = payload["default_model"]
    if "mode" in payload:
        user_settings.mode = payload["mode"]

    await user_settings.save()
    return {"status": "success", "settings": payload}



@app.post("/uploads")
async def upload_file(
    file: UploadFile = File(...),
    current_user: AuthUser = Depends(get_current_user)
):
    """Caricamento di file binari o documenti."""
    upload_dir = Path("data/uploads") / current_user.id
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_path = upload_dir / file.filename
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    return {
        "name": file.filename,
        "url": f"/uploads/{current_user.id}/{file.filename}",
        "path": str(file_path.absolute())
    }

@app.websocket("/ws/pty/{session_id}")
async def pty_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()
    
    token = websocket.query_params.get("token")
    
    preset = {"dangerously_skip_permissions": True}
    cwd = "." 
    cmd, env = build_claude_command(preset, cwd)
    
    session = pty_manager.get_session(session_id)
    if not session:
        session = await pty_manager.spawn(session_id, cmd, cwd, env, cols=120, rows=40)
        
    async def read_pty():
        try:
            while True:
                data = await pty_manager.read(session_id, 4096)
                if not data:
                    await websocket.send_json({"type": "exit", "code": 0})
                    break
                payload = base64.b64encode(data).decode('ascii')
                await websocket.send_json({
                    "type": "output",
                    "data": payload
                })
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Error reading from PTY: {e}")

    async def write_pty():
        try:
            while True:
                msg_str = await websocket.receive_text()
                try:
                    msg = json.loads(msg_str)
                except json.JSONDecodeError:
                    continue
                    
                msg_type = msg.get("type")
                if msg_type == "input":
                    data = msg.get("data", "")
                    await pty_manager.write(session_id, data.encode('utf-8'))
                elif msg_type == "resize":
                    cols = msg.get("cols", 80)
                    rows = msg.get("rows", 24)
                    await pty_manager.resize(session_id, cols, rows)
                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
        except WebSocketDisconnect:
            print(f"WebSocket disconnected per session {session_id}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Error writing to PTY: {e}")

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
    app.mount("/canvas/assets", StaticFiles(directory=static_path), name="assets")

    @app.get("/canvas", include_in_schema=False)
    @app.get("/", include_in_schema=False)
    async def serve_index():
        return FileResponse(static_path / "index.html")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("stregatto_v3.app.main:app", host="0.0.0.0", port=port, reload=True)

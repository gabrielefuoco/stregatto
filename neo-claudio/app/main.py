import os
import json
import logging
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Body
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

# Carica variabili d'ambiente dalla radice del repo
root_env = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(root_env)


from .db import init_db, ChatDB, UserSettingsDB
from .auth import get_current_user, AuthUser
from .chats import router as chats_router
from .bridge import run_claude_stream, cancel_session_process

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stregatto_v3.main")

app = FastAPI(title="Stregatto V3 API", version="3.0.0")

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
    logger.info("Stregatto V3 Database inizializzato con successo.")



# Includi le rotte CRUD delle Chat
app.include_router(chats_router)


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


@app.post("/agents/{agent_slug}/cancel")
async def cancel_agent_run(
    agent_slug: str,
    payload: dict = Body(default={}),
    current_user: AuthUser = Depends(get_current_user)
):
    """Endpoint per interrompere la generazione in corso."""
    session_id = payload.get("session_id")
    chat_id = payload.get("chat_id")
    cancelled = await cancel_session_process(session_id=session_id, chat_id=chat_id)
    return {"status": "cancelled" if cancelled else "not_found", "cancelled": cancelled}


@app.post("/agents/{agent_slug}/message")
async def send_agent_message(
    agent_slug: str,
    payload: dict = Body(...),
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Endpoint primario di chat.
    Riceve il messaggio dall'utente e restituisce uno stream SSE alimentato da Claude CLI.
    """
    messages = payload.get("messages", [])
    if not messages:
        raise HTTPException(status_code=400, detail="Il campo 'messages' è obbligatorio.")

    # Estraiamo il messaggio dell'utente e l'eventuale cronologia
    last_user_message = messages[-1]
    prompt_text = ""
    
    if isinstance(last_user_message.get("content"), list):
        for item in last_user_message["content"]:
            if item.get("type") == "text":
                prompt_text += item.get("text", "")
    elif isinstance(last_user_message.get("content"), str):
        prompt_text = last_user_message["content"]

    if not prompt_text:
        raise HTTPException(status_code=400, detail="Messaggio utente vuoto.")

    if len(messages) > 1:
        history_lines = []
        for msg in messages[:-1]:
            role = msg.get("role", "user").upper()
            content_str = ""
            if isinstance(msg.get("content"), list):
                content_str = " ".join([c.get("text", "") for c in msg["content"] if c.get("type") == "text"])
            elif isinstance(msg.get("content"), str):
                content_str = msg["content"]
            if content_str.strip():
                history_lines.append(f"[{role}]: {content_str.strip()}")
        if history_lines:
            prompt_text = "Cronologia della conversazione:\n" + "\n".join(history_lines) + f"\n\n[USER - Nuova Richiesta]: {prompt_text}"

    chat_id = payload.get("chat_id")
    session_id = None

    if chat_id:
        chat_obj = await ChatDB.objects().where(ChatDB.id == chat_id).first()
        if chat_obj and chat_obj.claude_session_id:
            session_id = chat_obj.claude_session_id

    user_settings = await UserSettingsDB.objects().where(UserSettingsDB.user_id == current_user.id).first()
    openrouter_key = (user_settings.openrouter_key if user_settings and user_settings.openrouter_key else os.environ.get("OPENROUTER_API_KEY"))
    
    req_model = payload.get("model")
    if not req_model or req_model == "default":
        model = (user_settings.default_model if user_settings and user_settings.default_model else "poolside/laguna-s-2.1:free")
    else:
        model = req_model

    # Ritorna lo stream SSE generato dal bridge
    generator = run_claude_stream(
        prompt=prompt_text,
        session_id=session_id,
        openrouter_key=openrouter_key,
        model=model,
        chat_id=chat_id
    )

    return StreamingResponse(generator, media_type="text/event-stream")


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

# Step 03 — Modello Dati Progetti e Sessioni

Questo documento definisce il nuovo schema del database per Stregatto V3. Il cambiamento principale consiste nell'abbandonare la struttura piatta delle chat (ChatDB) a favore di un modello gerarchico **Project → Session**, per supportare workspace multipli e tab multiple all'interno dello stesso progetto. Vengono inoltre introdotti gli **Agent Preset** per configurare le istanze di Claude Code e ampliate le **User Settings**.

---

## 1. Obiettivo

- **Sostituire ChatDB** con un modello gerarchico `ProjectDB` e `SessionDB`.
- **Aggiungere AgentPresetDB** per gestire configurazioni personalizzate (es. tool consentiti, mode, system prompt) per le istanze di Claude Code.
- **Estendere UserSettingsDB** con nuovi campi per preferenze UI (temi, sidebar) e configurazioni di rete (Tailscale IP/Port).
- **Creare una strategia di migrazione** per preservare i dati esistenti passando al nuovo schema.
- **Implementare nuovi API router** (`projects.py`, `sessions.py`, `presets.py`) per la gestione CRUD e le operazioni di stato.

---

## 2. Modello Concettuale

La nuova architettura dati segue questa gerarchia:

```text
User
 ├── Projects (folders/workspaces)
 │   ├── Session 1 (PTY instance, has state: active/suspended/archived)
 │   ├── Session 2
 │   └── ...
 ├── Agent Presets (reusable configurations)
 │   ├── Stregatto (default, full access, auto mode)
 │   ├── Guardian (read-only, plan mode) 
 │   └── Researcher (custom tools, web search focus)
 └── Settings (openrouter key, default model, preferences)
```

---

## 3. File: `app/db.py` (MODIFIED — Complete rewrite)

Di seguito il codice completo aggiornato per i modelli del database basati su **Piccolo ORM**.

```python
import uuid
from piccolo.table import Table
from piccolo.columns import Text, Boolean, Integer, JSON, Timestamp
from piccolo.columns.defaults.timestamp import TimestampNow

class ProjectDB(Table, tablename="stregatto_projects"):
    """Rappresenta un workspace/progetto dell'utente."""
    id = Text(primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Text(null=False)
    name = Text(default='Nuovo Progetto')
    path = Text(null=False)               # Absolute path to project folder (es. /home/user/myproject)
    mode = Text(default='local')          # 'local' (Tailscale) o 'cloud' (Docker sandbox)
    icon = Text(default='📁')
    default_preset_id = Text(null=True)   # ID dell'AgentPreset predefinito
    pinned = Boolean(default=False)
    created_at = Timestamp(default=TimestampNow())
    updated_at = Timestamp(default=TimestampNow())


class SessionDB(Table, tablename="stregatto_sessions"):
    """Sostituisce ChatDB. Rappresenta una sessione terminale/chat in un progetto."""
    id = Text(primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Text(null=False)         # FK a ProjectDB
    user_id = Text(null=False)
    name = Text(default='Nuova Sessione')
    claude_session_id = Text(null=True)   # Claude CLI session ID per il comando --resume
    preset_id = Text(null=True)           # FK a AgentPresetDB
    model = Text(null=True)
    state = Text(default='active')        # 'active', 'suspended', 'archived'
    pinned = Boolean(default=False)
    tab_order = Integer(default=0)
    context = JSON(default='{}')          # Metadati, es. { "terminal_size": [...], "scroll": 0 }
    created_at = Timestamp(default=TimestampNow())
    updated_at = Timestamp(default=TimestampNow())
    archived_at = Timestamp(null=True)


class AgentPresetDB(Table, tablename="stregatto_agent_presets"):
    """Configurazioni riutilizzabili per le istanze di Claude Code."""
    id = Text(primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Text(null=False)            # 'system' per i preset integrati globali
    slug = Text(null=False)               # Identificatore univoco es. 'stregatto-default'
    name = Text(null=False)
    icon = Text(default='🐱')
    description = Text(default='')
    model = Text(default='anthropic/claude-sonnet-4-20250514')
    system_prompt = Text(null=True)
    permission_mode = Text(default='auto') # 'plan', 'auto', 'acceptEdits', 'bypassPermissions'
    allowed_tools = JSON(default='[]')    # Array di stringhe, vuoto = tutti i tools
    mcp_servers = JSON(default='[]')      # MCP servers abilitati
    env_vars = JSON(default='{}')         # Variabili d'ambiente aggiuntive
    is_default = Boolean(default=False)
    created_at = Timestamp(default=TimestampNow())
    updated_at = Timestamp(default=TimestampNow())


class UserSettingsDB(Table, tablename="stregatto_user_settings"):
    """Preferenze e impostazioni globali dell'utente."""
    id = Text(primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Text(null=False, unique=True)
    openrouter_key = Text(null=True)
    default_model = Text(default='anthropic/claude-sonnet-4-20250514')
    # -- Nuovi campi --
    favorite_models = JSON(default='[]')  # Lista degli ID modello preferiti
    theme = Text(default='light')         # 'light' o 'dark'
    notifications_enabled = Boolean(default=True)
    sidebar_collapsed = Boolean(default=False)
    tailscale_ip = Text(null=True)        # IP della macchina locale sulla VPN Tailscale
    tailscale_port = Integer(default=8765) # Porta del demone PTY
    created_at = Timestamp(default=TimestampNow())
    updated_at = Timestamp(default=TimestampNow())
```

---

## 4. File: `app/projects.py` (NEW)

Router FastAPI per la gestione dei progetti dell'utente.

```python
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import os

from app.db import ProjectDB, SessionDB
from app.auth import get_current_user  # Assumendo una dependency per l'auth

router = APIRouter(prefix="/api/projects", tags=["Projects"])

class ProjectCreate(BaseModel):
    name: str
    path: str
    mode: str = 'local'
    icon: str = '📁'
    default_preset_id: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    mode: Optional[str] = None
    default_preset_id: Optional[str] = None
    pinned: Optional[bool] = None

@router.get("/")
async def list_projects(user = Depends(get_current_user)):
    projects = await ProjectDB.select().where(ProjectDB.user_id == user["id"]).order_by(
        ProjectDB.pinned, ascending=False
    ).order_by(ProjectDB.updated_at, ascending=False)
    return projects

@router.get("/{project_id}")
async def get_project(project_id: str, user = Depends(get_current_user)):
    project = await ProjectDB.objects().get(ProjectDB.id == project_id, ProjectDB.user_id == user["id"])
    if not project:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
    
    # Conta le sessioni attive
    session_count = await SessionDB.count().where(SessionDB.project_id == project_id)
    project_dict = project.__dict__.copy()
    project_dict["session_count"] = session_count
    return project_dict

@router.post("/")
async def create_project(data: ProjectCreate, user = Depends(get_current_user)):
    if data.mode == 'local' and not os.path.isabs(data.path):
         raise HTTPException(status_code=400, detail="Il path deve essere assoluto per i progetti locali")
    
    project = ProjectDB(
        user_id=user["id"],
        name=data.name,
        path=data.path,
        mode=data.mode,
        icon=data.icon,
        default_preset_id=data.default_preset_id
    )
    await project.save()
    return project

@router.put("/{project_id}")
async def update_project(project_id: str, data: ProjectUpdate, user = Depends(get_current_user)):
    project = await ProjectDB.objects().get(ProjectDB.id == project_id, ProjectDB.user_id == user["id"])
    if not project:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if update_data:
        for key, value in update_data.items():
            setattr(project, key, value)
        await project.save()
    
    return project

@router.delete("/{project_id}")
async def delete_project(project_id: str, user = Depends(get_current_user)):
    project = await ProjectDB.objects().get(ProjectDB.id == project_id, ProjectDB.user_id == user["id"])
    if not project:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
    
    # Elimina a cascata tutte le sessioni del progetto
    await SessionDB.delete().where(SessionDB.project_id == project_id)
    await project.remove()
    return {"status": "success", "message": "Progetto eliminato"}
```

---

## 5. File: `app/sessions.py` (NEW)

Router FastAPI per gestire le sessioni e il loro ciclo di vita (active, suspended, archived). Sostituisce il vecchio `chats.py`.

```python
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

from app.db import SessionDB, ProjectDB
from app.auth import get_current_user

router = APIRouter(prefix="/api", tags=["Sessions"])

class SessionCreate(BaseModel):
    name: Optional[str] = 'Nuova Sessione'
    preset_id: Optional[str] = None
    model: Optional[str] = None

class SessionUpdate(BaseModel):
    name: Optional[str] = None
    pinned: Optional[bool] = None
    tab_order: Optional[int] = None
    state: Optional[str] = None
    context: Optional[Dict[str, Any]] = None

@router.get("/projects/{project_id}/sessions")
async def list_project_sessions(project_id: str, user = Depends(get_current_user)):
    # Verifica accesso al progetto
    project = await ProjectDB.exists().where(ProjectDB.id == project_id, ProjectDB.user_id == user["id"])
    if not project:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
        
    sessions = await SessionDB.select().where(SessionDB.project_id == project_id).order_by(
        SessionDB.tab_order, ascending=True
    )
    
    # Raggruppa per stato (opzionale, o demandato al frontend)
    grouped = {"active": [], "suspended": [], "archived": []}
    for s in sessions:
        state = s.get("state", "active")
        if state in grouped:
            grouped[state].append(s)
            
    return grouped

@router.get("/sessions/{session_id}")
async def get_session(session_id: str, user = Depends(get_current_user)):
    session = await SessionDB.objects().get(SessionDB.id == session_id, SessionDB.user_id == user["id"])
    if not session:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    return session

@router.post("/projects/{project_id}/sessions")
async def create_session(project_id: str, data: SessionCreate, user = Depends(get_current_user)):
    session = SessionDB(
        project_id=project_id,
        user_id=user["id"],
        name=data.name,
        preset_id=data.preset_id,
        model=data.model,
        state='active'
    )
    await session.save()
    # In una implementazione reale, qui si emetterebbe un evento al worker per avviare la PTY
    return session

@router.put("/sessions/{session_id}")
async def update_session(session_id: str, data: SessionUpdate, user = Depends(get_current_user)):
    session = await SessionDB.objects().get(SessionDB.id == session_id, SessionDB.user_id == user["id"])
    if not session:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
        
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    for key, value in update_data.items():
        setattr(session, key, value)
    await session.save()
    return session

@router.put("/sessions/{session_id}/suspend")
async def suspend_session(session_id: str, user = Depends(get_current_user)):
    session = await SessionDB.objects().get(SessionDB.id == session_id, SessionDB.user_id == user["id"])
    if not session:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    
    session.state = 'suspended'
    await session.save()
    # TODO: Logica per inviare segnale SIGTERM/SIGINT al processo PTY
    return {"status": "suspended"}

@router.put("/sessions/{session_id}/resume")
async def resume_session(session_id: str, user = Depends(get_current_user)):
    session = await SessionDB.objects().get(SessionDB.id == session_id, SessionDB.user_id == user["id"])
    if not session:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    
    session.state = 'active'
    await session.save()
    # TODO: Logica per avviare una nuova PTY passando --resume <claude_session_id>
    return {"status": "resumed"}

@router.put("/sessions/{session_id}/archive")
async def archive_session(session_id: str, user = Depends(get_current_user)):
    session = await SessionDB.objects().get(SessionDB.id == session_id, SessionDB.user_id == user["id"])
    if not session:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
        
    session.state = 'archived'
    session.archived_at = datetime.now()
    await session.save()
    return {"status": "archived"}

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user = Depends(get_current_user)):
    session = await SessionDB.objects().get(SessionDB.id == session_id, SessionDB.user_id == user["id"])
    if not session:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
        
    await session.remove()
    return {"status": "deleted"}
```

---

## 6. File: `app/presets.py` (NEW)

Gestione delle configurazioni/agenti predefiniti.

```python
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from app.db import AgentPresetDB
from app.auth import get_current_user

router = APIRouter(prefix="/api/presets", tags=["Presets"])

class PresetCreate(BaseModel):
    name: str
    slug: str
    icon: str = '🐱'
    description: str = ''
    model: str = 'anthropic/claude-sonnet-4-20250514'
    system_prompt: Optional[str] = None
    permission_mode: str = 'auto'
    allowed_tools: List[str] = []
    mcp_servers: List[str] = []
    env_vars: Dict[str, str] = {}

class PresetUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None
    model: Optional[str] = None
    system_prompt: Optional[str] = None
    permission_mode: Optional[str] = None
    allowed_tools: Optional[List[str]] = None
    mcp_servers: Optional[List[str]] = None
    env_vars: Optional[Dict[str, str]] = None

@router.get("/")
async def list_presets(user = Depends(get_current_user)):
    # Ritorna sia i preset di sistema che quelli dell'utente
    presets = await AgentPresetDB.select().where(
        (AgentPresetDB.user_id == user["id"]) | (AgentPresetDB.user_id == 'system')
    )
    return presets

@router.post("/")
async def create_preset(data: PresetCreate, user = Depends(get_current_user)):
    preset = AgentPresetDB(
        user_id=user["id"],
        slug=data.slug,
        **data.dict(exclude={"slug"})
    )
    await preset.save()
    return preset

@router.put("/{preset_id}")
async def update_preset(preset_id: str, data: PresetUpdate, user = Depends(get_current_user)):
    preset = await AgentPresetDB.objects().get(AgentPresetDB.id == preset_id)
    if not preset:
        raise HTTPException(status_code=404, detail="Preset non trovato")
    
    if preset.user_id == 'system':
        raise HTTPException(status_code=403, detail="Impossibile modificare un preset di sistema")
        
    if preset.user_id != user["id"]:
        raise HTTPException(status_code=403, detail="Non autorizzato")

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    for key, value in update_data.items():
        setattr(preset, key, value)
    
    await preset.save()
    return preset

@router.delete("/{preset_id}")
async def delete_preset(preset_id: str, user = Depends(get_current_user)):
    preset = await AgentPresetDB.objects().get(AgentPresetDB.id == preset_id)
    if not preset:
        raise HTTPException(status_code=404, detail="Preset non trovato")
        
    if preset.user_id == 'system':
        raise HTTPException(status_code=403, detail="Impossibile eliminare un preset di sistema")
        
    if preset.user_id != user["id"]:
        raise HTTPException(status_code=403, detail="Non autorizzato")

    await preset.remove()
    return {"status": "deleted"}

@router.post("/seed")
async def seed_system_presets():
    """Endpoint interno/admin per popolare i preset di base."""
    # Definiti nella sezione 8 di questo documento
    pass
```

---

## 7. Migrazione Dati

Poiché si passa da una tabella piana `stregatto_chats` a una relazione `Project -> Session`, è necessaria una procedura di migrazione:

1. **Creazione delle Nuove Tabelle**: `stregatto_projects`, `stregatto_sessions`, `stregatto_agent_presets` e l'aggiornamento di `stregatto_user_settings` avvengono tramite `piccolo migrations new/forwards`.
2. **Creazione Progetto Default**: Per ogni utente attivo, viene creato un "Default Workspace" in `ProjectDB` avente come path la root directory dell'utente.
3. **Migrazione Dati**: Tutti i record di `stregatto_chats` vengono letti e inseriti in `stregatto_sessions` puntando al progetto di default creato al punto 2. Il vecchio `chat_id` di Claude viene mappato in `claude_session_id`.
4. **Cleanup**: Una volta validata la migrazione, la tabella `stregatto_chats` viene rimossa (dropped).

---

## 8. Built-in Agent Presets (Seed Data)

Questi preset rappresentano profili base di Claude con scopi specifici. Vengono inseriti tramite l'endpoint `/seed` o al primo avvio.

1. **Stregatto (Default)**
   - **Slug:** `system-stregatto-default`
   - **Icona:** 🐱
   - **Modello:** `anthropic/claude-sonnet-4-20250514`
   - **Permission Mode:** `auto` (o `bypassPermissions` in locale fidata)
   - **Allowed Tools:** `[]` (Tutti abilitati)
   - **Descrizione:** L'agente predefinito, sviluppatore full-stack con accesso completo a tutti i tool e permessi.

2. **Guardian**
   - **Slug:** `system-guardian-reviewer`
   - **Icona:** 🛡️
   - **Modello:** `anthropic/claude-opus-4-20250514` (Modello più ragionato, meno propenso agli update)
   - **Permission Mode:** `plan` (Richiede conferma prima di eseguire codice o scrivere)
   - **Allowed Tools:** `["Read", "Grep", "Glob", "Linter", "Git"]` (Solo tool di lettura e analisi)
   - **Descrizione:** Profilo orientato alla Code Review. Sola lettura, pianifica prima di agire. 

3. **Researcher**
   - **Slug:** `system-researcher`
   - **Icona:** 🔬
   - **Modello:** `anthropic/claude-sonnet-4-20250514`
   - **Permission Mode:** `auto`
   - **Allowed Tools:** `["Read", "WebFetch", "McpSearch", "Scraper"]`
   - **Descrizione:** Esperto in ricerca web e documentale. Analizza documentazione esterna tramite tool web.

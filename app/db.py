import os
import uuid
from piccolo.engine.postgres import PostgresEngine
from piccolo.engine.sqlite import SQLiteEngine
from piccolo.table import Table
from piccolo.columns import Text, Boolean, Integer, JSON, Timestamp
from piccolo.columns.defaults.timestamp import TimestampNow

# Configurazione Motore DB (SQLite in locale, Postgres in produzione/Supabase)
db_url = os.environ.get("DATABASE_URL")
if db_url and db_url.startswith("postgres"):
    dsn = db_url.replace("postgres://", "postgresql://", 1)
    DB_ENGINE = PostgresEngine(config={'dsn': dsn, 'statement_cache_size': 0})
else:
    DB_ENGINE = SQLiteEngine(path='core.db')



class ProjectDB(Table, tablename="stregatto_projects"):
    """Rappresenta un workspace/progetto dell'utente."""
    id = Text(primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Text(null=False)
    name = Text(default='Nuovo Progetto')
    path = Text(null=False)               # Absolute path to project folder
    mode = Text(default='local')          # 'local' (Tailscale) o 'cloud' (Docker sandbox)
    icon = Text(default='📁')
    default_preset_id = Text(null=True)   # ID dell'AgentPreset predefinito
    pinned = Boolean(default=False)
    created_at = Timestamp(default=TimestampNow())
    updated_at = Timestamp(default=TimestampNow())

    class Meta:
        db = DB_ENGINE


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
    context = JSON(default='{}')          # Metadati, es. { "terminal_size": [...], "scroll": 0 }
    created_at = Timestamp(default=TimestampNow())
    updated_at = Timestamp(default=TimestampNow())
    archived_at = Timestamp(null=True)

    class Meta:
        db = DB_ENGINE


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

    class Meta:
        db = DB_ENGINE


class UserSettingsDB(Table, tablename="stregatto_user_settings"):
    """Preferenze e impostazioni globali dell'utente."""
    id = Text(primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Text(null=False, unique=True)
    openrouter_key = Text(null=True)
    mode = Text(default="cloud")  # "cloud" (container Hetzner) o "local" (PC via Tailscale)
    default_model = Text(default='poolside/laguna-s-2.1:free')
    
    # -- Nuovi campi --
    favorite_models = JSON(default='[]')  # Lista degli ID modello preferiti
    theme = Text(default='light')         # 'light' o 'dark'
    notifications_enabled = Boolean(default=True)
    sidebar_collapsed = Boolean(default=False)
    tailscale_ip = Text(null=True)        # IP della macchina locale sulla VPN Tailscale
    tailscale_port = Integer(default=8765) # Porta del demone PTY
    created_at = Timestamp(default=TimestampNow())
    updated_at = Timestamp(default=TimestampNow())

    class Meta:
        db = DB_ENGINE


async def seed_default_presets(user_id: str = "system"):
    """Crea o aggiorna i 3 preset built-in."""
    presets = [
        {
            "slug": "system-stregatto-default",
            "name": "Stregatto",
            "icon": "🐱",
            "description": "L'agente predefinito, sviluppatore full-stack con accesso completo a tutti i tool e permessi.",
            "model": "poolside/laguna-s-2.1:free",
            "permission_mode": "auto",
            "allowed_tools": "[]",
            "is_default": True
        },
        {
            "slug": "system-guardian-reviewer",
            "name": "Guardian",
            "icon": "🛡️",
            "description": "Profilo orientato alla Code Review. Sola lettura, pianifica prima di agire.",
            "model": "poolside/laguna-s-2.1:free",
            "permission_mode": "plan",
            "allowed_tools": '["Read", "Grep", "Glob", "Linter", "Git"]',
            "is_default": False
        },
        {
            "slug": "system-researcher",
            "name": "Researcher",
            "icon": "🔬",
            "description": "Esperto in ricerca web e documentale. Analizza documentazione esterna tramite tool web.",
            "model": "poolside/laguna-s-2.1:free",
            "permission_mode": "auto",
            "allowed_tools": '["Read", "WebFetch", "McpSearch", "Scraper"]',
            "is_default": False
        }
    ]

    for p_data in presets:
        existing = await AgentPresetDB.objects().where(
            AgentPresetDB.slug == p_data["slug"],
            AgentPresetDB.user_id == user_id
        ).first()
        if not existing:
            await AgentPresetDB(
                user_id=user_id,
                **p_data
            ).save()
        else:
            existing.model = p_data["model"]
            await existing.save()



async def init_db():
    await ProjectDB.create_table(if_not_exists=True).run()
    await SessionDB.create_table(if_not_exists=True).run()
    await AgentPresetDB.create_table(if_not_exists=True).run()
    await UserSettingsDB.create_table(if_not_exists=True).run()

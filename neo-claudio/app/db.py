import os
from piccolo.columns import JSON, Text, Timestamp
from piccolo.engine.postgres import PostgresEngine
from piccolo.engine.sqlite import SQLiteEngine
from piccolo.table import Table

# Configurazione Motore DB (SQLite in locale, Postgres in produzione/Supabase)
db_url = os.environ.get("DATABASE_URL")
if db_url and db_url.startswith("postgres"):
    dsn = db_url.replace("postgres://", "postgresql://", 1)
    DB_ENGINE = PostgresEngine(config={'dsn': dsn, 'statement_cache_size': 0})
else:
    DB_ENGINE = SQLiteEngine(path='core.db')



class ChatDB(Table):
    """Tabella per memorizzare le conversazioni e mappare la chat ID all'ID sessione di Claude Code."""
    id = Text(primary_key=True)
    user_id = Text(null=False)
    name = Text(default="Nuova Chat")
    claude_session_id = Text(null=True)  # ID della sessione generato da Claude CLI per --resume
    messages = JSON(default="[]")
    context = JSON(default="{}")
    created_at = Timestamp()
    updated_at = Timestamp()


    class Meta:
        tablename = "stregatto_chats"
        db = DB_ENGINE


class UserSettingsDB(Table):
    """Impostazioni e credenziali per singolo utente."""
    user_id = Text(primary_key=True)
    openrouter_key = Text(null=True)
    mode = Text(default="cloud")  # "cloud" (container Hetzner) o "local" (PC via Tailscale)
    default_model = Text(default="anthropic/claude-3.5-sonnet")

    class Meta:
        tablename = "stregatto_user_settings"
        db = DB_ENGINE


ChatDB._meta.db = DB_ENGINE
UserSettingsDB._meta.db = DB_ENGINE


async def init_db():
    await ChatDB.create_table(if_not_exists=True).run()
    await UserSettingsDB.create_table(if_not_exists=True).run()





import os
from piccolo.columns import JSON
from piccolo.engine.postgres import PostgresEngine
from piccolo.engine.sqlite import SQLiteEngine
from cat.db import UserScopedDB

# Configura il motore DB basato su DATABASE_URL (es. fornito da Supabase)
db_url = os.environ.get("DATABASE_URL")
if db_url and db_url.startswith("postgres"):
    # Assicura il formato corretto per Piccolo
    dsn = db_url.replace("postgres://", "postgresql://", 1)
    DB_ENGINE = PostgresEngine(config={'dsn': dsn})
else:
    DB_ENGINE = SQLiteEngine(path='core.db')

class ChatDB(UserScopedDB):
    """A saved conversation: its messages and the context they ran in."""
    messages = JSON()
    context = JSON()

    class Meta:
        tablename = "ccat_chats"
        db = DB_ENGINE

ChatDB.create_table(if_not_exists=True).run_sync()

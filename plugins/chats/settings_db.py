from piccolo.columns import Text
from cat.db import UserScopedDB
from .db import DB_ENGINE

class UserSettingsDB(UserScopedDB):
    mcp_url = Text(null=True)
    mcp_token = Text(null=True)

    class Meta:
        tablename = "ccat_settings"
        db = DB_ENGINE

UserSettingsDB.create_table(if_not_exists=True).run_sync()

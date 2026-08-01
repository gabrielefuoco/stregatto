import os
from mcp_client.directive import MCPDirective
from mcp_client.config import MCPServer

class FilesystemMCPDirective(MCPDirective):
    slug = "desktop_commander"
    name = "Desktop Commander MCP"
    description = "Lettura, scrittura e navigazione dei file del file system locale."

    async def _composed_servers(self):
        mcp_url = None
        mcp_token = None
        
        # 1. Tentiamo di leggere l'URL remoto dal DB dell'utente
        try:
            from cat import user
            from plugins.chats.settings_db import UserSettingsDB
            user_id = getattr(user, "id", "anonymous")
            settings = await UserSettingsDB.objects().where(UserSettingsDB.user_id == user_id).first()
            if settings and settings.mcp_url:
                mcp_url = settings.mcp_url
                mcp_token = settings.mcp_token
        except ImportError:
            pass # Se il plugin chats non è caricato, saltiamo e usiamo il fallback locale
            
        # 2. Se l'utente ha impostato un URL remoto (Tunnel Tailscale)
        if mcp_url:
            # L'URL dovrebbe puntare all'endpoint SSE. DesktopCommander usa /sse
            remote_url = mcp_url if mcp_url.endswith("/sse") else f"{mcp_url.rstrip('/')}/sse"

            return [
                MCPServer(
                    name="desktop_commander",
                    description=self.description + " (DesktopCommanderMCP via Tailscale VPN)",
                    url=remote_url,
                    auth_type="apikey" if mcp_token else "none",
                    token=mcp_token
                )
            ]
            
        # 3. Fallback: Esecuzione Locale (Sviluppo)
        root_dir = os.getcwd()
        return [
            MCPServer(
                name="filesystem_fallback",
                description=self.description + " (Fallback Node.js Locale)",
                command="npx",
                args=["-y", "@modelcontextprotocol/server-filesystem", root_dir]
            )
        ]

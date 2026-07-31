from cat import hook, log
from .config import Settings as MCPSettings
from .manager import MCPManager

@hook
async def after_cat_bootstrap(cat=None):
    """Pre-warm all configured MCP servers at application startup."""
    try:
        log.info("[mcp_client] Startup: Inizializzazione e pre-warming dei server MCP...")
        manager = MCPManager.get_instance()
        settings = MCPSettings()
        if settings and hasattr(settings, "servers") and settings.servers:
            for server in settings.servers:
                manager.register_server(server)
                await manager.get_or_create_client(server)
    except Exception as e:
        log.warning(f"[mcp_client] Avviso durante il pre-warming iniziale: {e}")

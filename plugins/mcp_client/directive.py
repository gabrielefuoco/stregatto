"""
The MCP directive — attach MCP servers via a ultra-lightweight Lazy Meta-Tool Proxy.
"""

from typing import Dict, Any
from cat import Directive, Agent, log
from cat.mad_hatter.decorators import Tool
from cat.types import Message

from .config import Settings as MCPSettings
from .manager import MCPManager


class MCPDirective(Directive):
    slug = "mcp"
    name = "MCP"
    description = "Connects MCP servers via a lightweight Lazy Meta-Tool Proxy."

    Settings = MCPSettings

    def __init__(self, servers=None):
        self._servers_override = servers

    async def _composed_servers(self):
        if self._servers_override is not None:
            return self._servers_override
        settings = await self.load_settings()
        return settings.servers if settings else []

    async def start(self, agent: Agent) -> None:
        servers = await self._composed_servers()
        if not servers:
            return

        manager = MCPManager.get_instance()
        server_summaries = []

        # Register servers globally and build a tiny 1-line summary per server
        for server in servers:
            try:
                manager.register_server(server)
                await manager.get_or_create_client(server)
                tools_list = manager.raw_tools.get(server.name, [])
                
                desc = server.description if hasattr(server, "description") and server.description else f"Accesso a {server.name}"
                server_summaries.append(f"- Server '{server.name}': {desc} ({len(tools_list)} azioni)")
            except Exception as e:
                log.error(f"MCP directive: error initializing '{server.name}': {e}")

        # Avoid duplicate tool injection
        if any(getattr(t, "name", "") == "mcp_tool" for t in agent.tools):
            return

        summary_text = "\n".join(server_summaries)

        # 1. Deterministic tool to inspect actions and schemas of a specific server on demand
        async def list_mcp_actions(server: str) -> str:
            """Restituisce l'elenco esatto delle azioni e degli schemi dei parametri (evidenziando i parametri [REQUIRED]) per un server MCP."""
            raw_tools = manager.raw_tools.get(server, [])
            if not raw_tools:
                available = manager.get_all_server_names()
                return f"Server '{server}' non trovato. Server registrati disponibili: {available}"
            
            lines = []
            for t in raw_tools:
                schema_info = getattr(t, "parameters", None) or getattr(t, "inputSchema", None) or {}
                properties = schema_info.get("properties", {}) if isinstance(schema_info, dict) else {}
                required_fields = schema_info.get("required", []) if isinstance(schema_info, dict) else []
                
                params_desc = []
                for p_name, p_info in properties.items():
                    req_tag = " [REQUIRED]" if p_name in required_fields else ""
                    p_type = p_info.get("type", "any") if isinstance(p_info, dict) else "any"
                    params_desc.append(f"{p_name}: {p_type}{req_tag}")
                
                param_str = f"({', '.join(params_desc)})" if params_desc else "()"
                lines.append(f"- action: '{t.name}'{param_str} -> {t.description or 'N/A'}")
            
            return f"Azioni e schemi per il server '{server}' ({len(raw_tools)} azioni totali):\n\n" + "\n".join(lines)

        # 2. Deterministic execution tool
        async def mcp_tool(server: str, action: str, params: Dict[str, Any] = {}) -> str:
            return await manager.execute_tool(server, action, params)

        mcp_tool.__doc__ = (
            "Esegue un'azione su un server MCP registrato.\n"
            "PROCEDURA: Se vuoi usare un server MCP, usa PRIMA `list_mcp_actions(server='nome_server')` per scoprire i nomi esatti delle azioni e dei parametri accettati, poi chiama `mcp_tool`."
        )
        # We no longer inject the system_prompt here because `start()` runs per-directive,
        # meaning only the first server would get injected. We do it in `step()` instead.

        agent.tools.append(Tool.from_decorated_function(list_mcp_actions))
        agent.tools.append(Tool.from_decorated_function(mcp_tool))
        if not any(getattr(t, "name", "") == "read_resource" for t in agent.tools):
            agent.tools.append(self._read_resource_tool(servers))

    async def step(self, agent: Agent) -> None:
        # Preveniamo l'inserimento duplicato se ci sono più direttive MCP
        if "\nSERVER MCP DISPONIBILI:\n" in agent.system_prompt:
            return
            
        manager = MCPManager.get_instance()
        server_summaries = []
        
        # Ora che tutte le direttive hanno fatto start(), leggiamo dal manager globale
        for server_name in manager.get_all_server_names():
            tools_list = manager.raw_tools.get(server_name, [])
            server_obj = manager.servers.get(server_name)
            desc = server_obj.description if server_obj and getattr(server_obj, "description", None) else f"Accesso a {server_name}"
            server_summaries.append(f"- Server '{server_name}': {desc} ({len(tools_list)} azioni)")
            
        summary_text = "\n".join(server_summaries)
        
        mcp_instructions = (
            f"\n\nSERVER MCP DISPONIBILI:\n{summary_text}\n\n"
            "IMPORTANTE: Hai GIÀ accesso a questi server tramite i tuoi tool MCP. "
            "Se l'utente ti chiede qualcosa di correlato (es. controllare email, cercare sul web), "
            "NON RIFIUTARE. Usa PRIMA `list_mcp_actions(server)` per scoprire le azioni esatte "
            "e poi chiama `mcp_tool` per eseguirle."
        )
        agent.system_prompt += mcp_instructions

    async def finish(self, agent: Agent) -> None:
        pass

    def _read_resource_tool(self, servers) -> Tool:
        """Build the injected `read_resource(uri)` internal tool."""
        async def read_resource(uri: str):
            """Read an MCP resource by its URI and return its contents."""
            manager = MCPManager.get_instance()
            for server in servers:
                try:
                    client = await manager.get_or_create_client(server)
                    if client:
                        contents = await client.read_resource(uri)
                        if contents:
                            blocks = [
                                {"type": "resource", "resource": rc.model_dump()}
                                for rc in contents
                            ]
                            return Message(role="tool", content=blocks)
                except Exception:
                    continue
            return f"Error: no connected MCP server exposes resource {uri!r}"

        return Tool.from_decorated_function(read_resource)

import asyncio
from typing import Dict, List, Optional
from cat import log
from cat.mad_hatter.decorators import Tool
from .config import MCPServer, build_client

class MCPManager:
    _instance = None

    def __init__(self):
        self.servers: Dict[str, MCPServer] = {}
        self.clients: Dict[str, any] = {}
        self.raw_tools: Dict[str, List] = {}
        self._lock = asyncio.Lock()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def register_server(self, server: MCPServer):
        """Register server config globally in the manager."""
        self.servers[server.name] = server

    def get_all_server_names(self) -> List[str]:
        return list(self.servers.keys())

    async def get_or_create_client(self, server: MCPServer):
        async with self._lock:
            key = server.name
            self.servers[key] = server
            if key in self.clients:
                return self.clients[key]

            try:
                log.info(f"[MCPManager] Avvio connessione per MCP '{key}'...")
                client = build_client(server)
                await client.__aenter__()
                self.clients[key] = client
                
                # Fetch and cache tool schemas ONCE
                mcp_tools = await client.list_tools()
                self.raw_tools[key] = mcp_tools
                log.info(f"[MCPManager] Connesso a '{key}' con successo ({len(mcp_tools)} tool).")
                return client
            except Exception as e:
                log.error(f"[MCPManager] Errore connessione server MCP '{key}': {e}")
                return None

    async def execute_tool(self, server_name: str, action: str, params: dict) -> str:
        """Strict, deterministic execution of an MCP tool."""
        server = self.servers.get(server_name)
        if not server:
            available = list(self.servers.keys())
            return (
                f"Error: MCP Server '{server_name}' non trovato. "
                f"I server MCP disponibili sono: {available}"
            )

        client = await self.get_or_create_client(server)
        if not client:
            return f"Error: Impossibile connettersi al server MCP '{server_name}'."

        available_tools = [t.name for t in self.raw_tools.get(server.name, [])]
        if available_tools and action not in available_tools:
            return (
                f"Error: Azione '{action}' non trovata sul server '{server_name}'. "
                f"Azioni disponibili su '{server_name}': {available_tools}"
            )

        try:
            result = await asyncio.wait_for(client.call_tool(action, params or {}), timeout=30.0)
            
            if getattr(result, "isError", False):
                return f"Errore MCP: {result}"
                
            text_blocks = []
            for item in getattr(result, "content", []):
                if getattr(item, "type", "") == "text":
                    text_blocks.append(item.text)
                elif hasattr(item, "text"):
                    text_blocks.append(item.text)
                else:
                    text_blocks.append(f"[{getattr(item, 'type', 'unknown')} content]")
            
            if text_blocks:
                return "\n\n".join(text_blocks)
                
            return str(result)
        except asyncio.TimeoutError:
            return f"Errore: L'esecuzione di {action} su {server_name} è andata in timeout (30s)."
        except Exception as err:
            return f"Errore durante l'esecuzione di {action} su {server_name}: {err}"

    async def shutdown(self):
        async with self._lock:
            for key, client in list(self.clients.items()):
                try:
                    await client.__aexit__(None, None, None)
                except Exception as e:
                    log.error(f"[MCPManager] Errore spegnimento '{key}': {e}")
            self.clients.clear()
            self.raw_tools.clear()

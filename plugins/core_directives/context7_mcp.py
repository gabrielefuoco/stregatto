from mcp_client.directive import MCPDirective
from mcp_client.config import MCPServer

class Context7MCPDirective(MCPDirective):
    slug = "context7"
    name = "Context7 MCP"
    description = "Ricerca di documentazione tecnica aggiornata, librerie e specifica di Cheshire Cat AI."

    async def _composed_servers(self):
        return [
            MCPServer(
                name="context7",
                description=self.description,
                command="npx",
                args=["-y", "@upstash/context7-mcp"]
            )
        ]

from mcp_client.directive import MCPDirective
from mcp_client.config import MCPServer

class TavilyMCPDirective(MCPDirective):
    slug = "tavily"
    name = "Tavily MCP"
    description = "Motore di ricerca web in tempo reale per notizie, informazioni ed articoli online."

    async def _composed_servers(self):
        return [
            MCPServer(
                name="tavily",
                description=self.description,
                command="npx",
                args=["-y", "tavily-mcp"]
            )
        ]

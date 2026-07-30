from mcp_client.directive import MCPDirective
from mcp_client.config import MCPServer

class TavilyMCPDirective(MCPDirective):
    slug = "tavily"
    name = "Tavily MCP"
    description = "Provides tools for AI-optimized web search and extraction via Tavily."

    async def _composed_servers(self):
        """Returns the dynamically configured MCP Server for Tavily."""
        
        # The TAVILY_API_KEY is loaded from the .env file automatically by the framework.
        return [
            MCPServer(
                name="tavily",
                command="npx",
                args=["-y", "mcp-tavily-search"]
            )
        ]

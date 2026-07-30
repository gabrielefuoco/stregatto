from mcp_client.directive import MCPDirective
from mcp_client.config import MCPServer

class FetchMCPDirective(MCPDirective):
    slug = "fetch"
    name = "Fetch MCP"
    description = "Provides tools to fetch and read raw HTML from URLs, converting them to clean Markdown."

    async def _composed_servers(self):
        """Returns the dynamically configured MCP Server for Fetch."""
        
        return [
            MCPServer(
                name="fetch",
                command="npx",
                args=["-y", "mcp-server-fetch-typescript"]
            )
        ]

from mcp_client.directive import MCPDirective
from mcp_client.config import MCPServer

class Context7MCPDirective(MCPDirective):
    slug = "context7"
    name = "Context7 MCP"
    description = "Provides access to the Context7 knowledge base and search tools."

    async def _composed_servers(self):
        """Returns the dynamically configured MCP Server for Context7."""
        
        # Here we configure the stdio command for context7.
        return [
            MCPServer(
                name="context7",
                command="npx",
                args=["-y", "@upstash/context7-mcp"]
            )
        ]

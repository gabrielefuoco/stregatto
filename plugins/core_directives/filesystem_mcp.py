from mcp_client.directive import MCPDirective
from mcp_client.config import MCPServer

class FilesystemMCPDirective(MCPDirective):
    slug = "filesystem"
    name = "Filesystem MCP"
    description = "Provides access to the local filesystem using standard MCP tools."

    async def _composed_servers(self):
        """Returns the dynamically configured MCP Server for the filesystem."""
        
        # Here we configure the stdio command. npx will fetch the package and run it.
        # We restrict the filesystem root to the current project directory for safety.
        return [
            MCPServer(
                name="filesystem",
                command="npx",
                args=["-y", "@modelcontextprotocol/server-filesystem", "C:/Users/gabri/APP/stregatto"]
            )
        ]

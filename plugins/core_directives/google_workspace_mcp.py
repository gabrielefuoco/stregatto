from mcp_client.directive import MCPDirective
from mcp_client.config import MCPServer

class GoogleWorkspaceMCPDirective(MCPDirective):
    slug = "google_workspace"
    name = "Google Workspace MCP"
    description = "Provides access to Gmail, Calendar, Drive, Docs, Sheets, Slides, and Forms via Google Workspace API."

    async def _composed_servers(self):
        """Returns the dynamically configured MCP Server for Google Workspace."""
        
        # The server requires a credentials.json file in the working directory (project root),
        # which we have placed there.
        return [
            MCPServer(
                name="google_workspace",
                command="npx",
                args=["-y", "google-workspace-mcp", "serve"]
            )
        ]

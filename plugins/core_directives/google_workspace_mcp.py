from mcp_client.directive import MCPDirective
from mcp_client.config import MCPServer

class GoogleWorkspaceMCPDirective(MCPDirective):
    slug = "google_workspace"
    name = "Google Workspace MCP"
    description = "Accesso a Gmail, Calendar, Drive, Docs, Sheets, Slides e Forms via Google Workspace API."

    async def _composed_servers(self):
        return [
            MCPServer(
                name="google_workspace",
                description=self.description,
                command="npx",
                args=["-y", "google-workspace-mcp", "serve"]
            )
        ]

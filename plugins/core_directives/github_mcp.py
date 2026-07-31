from mcp_client.directive import MCPDirective
from mcp_client.config import MCPServer

class GitHubMCPDirective(MCPDirective):
    slug = "github"
    name = "GitHub MCP"
    description = "Gestione di repository, issue, pull request e codice su GitHub."

    async def _composed_servers(self):
        return [
            MCPServer(
                name="github",
                description=self.description,
                command="npx",
                args=["-y", "@modelcontextprotocol/server-github"]
            )
        ]

from mcp_client.directive import MCPDirective
from mcp_client.config import MCPServer
import os

class GithubMCPDirective(MCPDirective):
    slug = "github"
    name = "GitHub MCP"
    description = "Provides tools to read and search GitHub repositories, files, PRs, and issues."

    async def _composed_servers(self):
        """Returns the dynamically configured MCP Server for GitHub."""
        # Inject the token from the environment variable
        token = os.environ.get("GITHUB_PERSONAL_ACCESS_TOKEN", "")
        
        return [
            MCPServer(
                name="github",
                command="npx",
                args=["-y", "@modelcontextprotocol/server-github"]
            )
        ]

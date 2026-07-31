from mcp_client.directive import MCPDirective
from mcp_client.config import MCPServer

class FetchMCPDirective(MCPDirective):
    slug = "fetch"
    name = "Fetch MCP"
    description = "Download ed estrazione di contenuti da URL web via HTTP."

    async def _composed_servers(self):
        return [
            MCPServer(
                name="fetch",
                description=self.description,
                command="uvx",
                args=["--with", "mcp==1.0.0", "mcp-server-fetch", "--ignore-robots-txt"]
            )
        ]

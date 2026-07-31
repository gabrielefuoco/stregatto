import os
from mcp_client.directive import MCPDirective
from mcp_client.config import MCPServer

class FilesystemMCPDirective(MCPDirective):
    slug = "filesystem"
    name = "Filesystem MCP"
    description = "Lettura, scrittura e navigazione dei file del file system locale."

    async def _composed_servers(self):
        root_dir = os.getcwd()
        return [
            MCPServer(
                name="filesystem",
                description=self.description,
                command="npx",
                args=["-y", "@modelcontextprotocol/server-filesystem", root_dir]
            )
        ]

"""
MCP server configuration for the mcp_client plugin.
"""

from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field
from fastmcp import Client
from fastmcp.client.auth import BearerAuth
from fastmcp.mcp_config import RemoteMCPServer, StdioMCPServer


AuthType = Literal["none", "apikey", "oauth2"]

class MCPServer(BaseModel):
    """A single MCP server the Cat connects to as a stateless client."""

    name: str = Field(description="Short label; namespaces this server's tools.")
    description: Optional[str] = Field(default=None, description="Human-readable description of what this MCP server provides.")
    
    # Remote/HTTP config
    url: Optional[str] = Field(default=None, description="The server's MCP endpoint URL.")
    auth_type: AuthType = "none"
    token: Optional[str] = Field(
        default=None,
        description="Bearer token, required when auth_type = 'apikey'.",
    )
    
    # Stdio config
    command: Optional[str] = Field(default=None, description="Command to execute for stdio servers (e.g. 'npx').")
    args: List[str] = Field(default_factory=list, description="Arguments for the stdio command.")

    def to_remote(self) -> Any:
        """Convert to a fastmcp RemoteMCPServer or StdioMCPServer."""
        if self.command:
            import shutil
            import os
            from dotenv import load_dotenv
            load_dotenv()
            env = dict(os.environ)
            env["PYTHONUTF8"] = "1"  # Force UTF-8 for Python MCP servers to avoid UnicodeDecodeError
            cmd = shutil.which(self.command) or self.command
            return StdioMCPServer(command=cmd, args=self.args, env=env, keep_alive=True)
            
        if not self.url:
            raise ValueError(f"MCP server '{self.name}' must define either 'url' or 'command'.")
            
        if self.auth_type == "oauth2":
            raise ValueError(
                f"MCP server '{self.name}': oauth2 auth is not supported yet. "
                "Use auth_type 'none' or 'apikey'."
            )

        auth = None
        if self.auth_type == "apikey":
            if not self.token:
                raise ValueError(
                    f"MCP server '{self.name}': auth_type 'apikey' requires a token."
                )
            auth = BearerAuth(token=self.token)

        return RemoteMCPServer(url=self.url, auth=auth)


def build_client(server: MCPServer) -> Client:
    """A fresh, stateless fastmcp Client for one server."""
    return Client(server.to_remote().to_transport())


class Settings(BaseModel):
    """Typed settings for the MCP directive: the servers to attach."""

    servers: List[MCPServer] = Field(
        default_factory=list,
        description="MCP servers whose tools this directive adds to an agent.",
    )

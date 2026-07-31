import asyncio
from cat.ambient.runtime import ccat

async def test():
    from plugins.mcp_client.manager import MCPManager
    manager = MCPManager.get_instance()
    
    # We need to manually register fetch server because we are bypassing standard CCat bootstrap
    from plugins.mcp_client.config import MCPServer
    fetch_server = MCPServer(
        name="fetch",
        description="Fetch MCP",
        command="uvx",
        args=["--with", "mcp==1.0.0", "mcp-server-fetch", "--ignore-robots-txt"]
    )
    
    manager.register_server(fetch_server)
    
    print("Connecting...")
    await manager.get_or_create_client(fetch_server)
    print("Executing fetch...")
    res = await manager.execute_tool('fetch', 'fetch', {'url': 'https://it.wikipedia.org/wiki/Pagina_principale'})
    print(f"Result length: {len(res)}")
    print("First 200 chars:")
    print(res[:200])
    
if __name__ == "__main__":
    asyncio.run(test())

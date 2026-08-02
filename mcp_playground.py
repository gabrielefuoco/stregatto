import asyncio
import os
import json
from dotenv import load_dotenv

load_dotenv(override=True)

async def run():
    from plugins.mcp_client.manager import MCPManager
    from plugins.mcp_client.config import MCPServer
    
    manager = MCPManager.get_instance()
    notion_server = MCPServer(
        name="notion",
        description="Official Notion MCP Server",
        command="npx",
        args=["-y", "@notionhq/notion-mcp-server"]
    )
    
    manager.register_server(notion_server)
    await manager.get_or_create_client(notion_server)
    
    print("--- 1. Search ---")
    search_res = await manager.execute_tool('notion', 'API-post-search', {"query": "Test", "page_size": 5})
    print("Search Result:", search_res[:500])
    
    # Let's see if we can create a page at the workspace root
    # Wait, the parent can be a page_id or workspace (not all integrations support workspace parent)
    
if __name__ == "__main__":
    asyncio.run(run())

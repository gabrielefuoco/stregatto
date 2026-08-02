import asyncio
import json
import os
from dotenv import load_dotenv

load_dotenv()

async def dump_tools():
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
    
    tools = manager.raw_tools.get("notion", [])
    result = []
    for t in tools:
        # Schema may be in .inputSchema or .parameters depending on fastmcp version
        schema = getattr(t, "inputSchema", None) or getattr(t, "parameters", None) or {}
        if hasattr(schema, "model_dump"):
            schema = schema.model_dump()
            
        result.append({
            "name": t.name,
            "description": t.description,
            "schema": schema
        })
        
    with open("notion_tools_schema.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

if __name__ == "__main__":
    asyncio.run(dump_tools())

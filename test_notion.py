import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def test():
    from plugins.mcp_client.manager import MCPManager
    manager = MCPManager.get_instance()
    
    from plugins.mcp_client.config import MCPServer
    notion_server = MCPServer(
        name="notion",
        description="Official Notion MCP Server",
        command="npx",
        args=["-y", "@notionhq/notion-mcp-server"]
    )
    
    manager.register_server(notion_server)
    
    print("Connecting to Notion (NOTION_API_KEY is: " + str(bool(os.environ.get("NOTION_API_KEY"))) + ")...")
    try:
        await manager.get_or_create_client(notion_server)
        print("Connected!")
        
        tools = manager.raw_tools.get("notion", [])
        print(f"Discovered {len(tools)} tools:")
        for t in tools:
            print(f"- {t.name}")
            
        print("Test passed.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        # Clean up
        pass
    
if __name__ == "__main__":
    asyncio.run(test())

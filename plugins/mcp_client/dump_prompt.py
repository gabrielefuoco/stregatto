import asyncio
from cat.ambient.runtime import ccat
from cat.services.agents.base import Agent

async def main():
    cat = ccat()
    agent = await cat.get("agents", "workspace")
    from cat.types import Task
    
    # We will simulate a run but just get the prompt
    agent.task = Task(messages=[])
    agent.system_prompt = await agent.get_system_prompt()
    agent.tools = await agent.list_tools()
    agent.directives = await agent._resolve_directives()
    
    await agent.start()
    
    print("----- FINAL SYSTEM PROMPT -----")
    print(agent.system_prompt)
    print("-------------------------------")

if __name__ == "__main__":
    asyncio.run(main())

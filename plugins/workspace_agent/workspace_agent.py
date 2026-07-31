import os
from cat import Agent

class WorkspaceAgent(Agent):
    slug = "workspace"
    name = "Workspace Agent"
    description = "A versatile assistant capable of file management, python code execution, web search, and MCP integrations."
    directives = ["skills", "clock", "shell", "todo_memory", "isolated_memory", "filesystem", "tavily", "google_workspace", "context7", "fetch", "github", "python_interpreter", "document_reader", "artifacts"]

    system_prompt = (
        f"You are a helpful Workspace Agent. You have access to local file management, Python execution, and external MCP tools. "
        f"Your allowed root directory is {os.getcwd()}. Always use absolute paths for file operations.\n"
        "To discover available actions and exact parameter schemas for any server, use `list_mcp_actions(server)`."
    )

from cat import Agent

class TestNoMCPAgent(Agent):
    slug = "test_no_mcp"
    name = "Test No MCP Agent"
    description = "Workspace agent without MCP directives"
    directives = ["skills", "clock", "shell", "todo_memory", "isolated_memory", "filesystem", "python_interpreter", "document_reader", "artifacts"]
    system_prompt = "Sei un assistente di test."

class TestNoMemoryAgent(Agent):
    slug = "test_no_memory"
    name = "Test No Memory Agent"
    description = "Workspace agent without Memory directives"
    directives = ["skills", "clock", "shell", "filesystem", "tavily", "google_workspace", "context7", "fetch", "github", "python_interpreter", "document_reader", "artifacts"]
    system_prompt = "Sei un assistente di test."

class TestLeanAgent(Agent):
    slug = "test_lean"
    name = "Test Lean Agent"
    description = "Minimal Workspace agent"
    directives = ["filesystem", "artifacts", "clock"]
    system_prompt = "Sei un assistente di test."

class TestMCPOnlyAgent(Agent):
    slug = "test_mcp_only"
    name = "Test MCP Only Agent"
    description = "MCP only agent"
    directives = ["context7"]
    system_prompt = "Sei un assistente di test."

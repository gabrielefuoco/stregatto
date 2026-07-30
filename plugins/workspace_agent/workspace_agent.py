import os
from cat import Agent

class WorkspaceAgent(Agent):
    slug = "workspace"
    name = "Workspace Agent"
    description = "A simple assistant that can read files from the file system."
    # We can add the newly extracted directives here as an example, or keep it empty
    directives = ["skills", "clock", "shell", "todo_memory", "isolated_memory", "filesystem", "tavily", "google_workspace", "context7", "fetch", "github", "python_interpreter", "document_reader", "artifacts"]

    system_prompt = (
        f"You are a helpful Workspace Agent. You can read and write files from the file system "
        f"to assist the user. Your allowed root directory is {os.getcwd()}. "
        "Always use absolute paths starting from this root directory. "
        "You do not perform any destructive actions."
    )
